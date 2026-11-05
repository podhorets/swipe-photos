import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Application from 'expo-application';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { useSettingsStore, type Appearance } from '@/stores/settingsStore';
import { usePlanStore } from '@/stores/planStore';
import { effectiveBatchSize, isPro } from '@/lib/planUtils';
import { toDateString } from '@/lib/streakUtils';
import { cancelOnThisDayNotification, scheduleOnThisDayNotification } from '@/lib/notifications';
import { useGalleryStore } from '@/stores/galleryStore';
import { Card } from '@/components/ui/Card';
import { BackCircle } from '@/components/ui/CircleButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { RowDivider, SectionLabel, SettingsRow } from '@/components/ui/SettingsRow';
import { StatusBarScrim } from '@/components/ui/StatusBarScrim';
import { Toggle } from '@/components/ui/Toggle';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { APP_STORE_ID, DEV_TOOLS_ENABLED, FREE_PLAN, LEGAL, STORAGE_KEYS } from '@/constants/config';
import { manageSubscriptions, restore } from '@/lib/purchases';
import { createMMKV } from 'react-native-mmkv';
import { posthog } from '@/lib/posthog';

const storage = createMMKV();

const BATCH_OPTIONS = [25, 50, 100] as const;

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <SectionLabel>{title}</SectionLabel>
      <Card radius={20} className="overflow-hidden">
        {children}
      </Card>
    </View>
  );
}

// ─── Row variants ─────────────────────────────────────────────────────────────

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className="w-7 h-7 rounded-full bg-tint items-center justify-center active:opacity-60"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Icon name={icon} size={15} color={t.accent.onTint} strokeWidth={2.4} />
    </Pressable>
  );
}

/** −/+ stepper for a small bounded integer (dev tools). */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <StepButton icon="remove" label={`${label}: decrease`} disabled={value <= min} onPress={() => onChange(value - 1)} />
      <Text className="text-fg text-[15px] font-bold text-center" style={{ width: 18 }}>
        {value}
      </Text>
      <StepButton icon="add" label={`${label}: increase`} disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function BatchSizeRow() {
  const batchSize = useSettingsStore((s) => s.batchSize);
  const setBatchSize = useSettingsStore((s) => s.setBatchSize);
  const planState = usePlanStore();
  const pro = isPro(planState);

  // Free plan: stored 50/100 stays untouched but the control shows the clamped
  // value, and locked options route to the paywall instead of selecting.
  const effective = effectiveBatchSize(planState, batchSize);

  return (
    <SettingsRow icon="shuffle" color="blue" label="Random batch size">
      <View className="mt-3">
        <SegmentedControl
          variant="tint"
          options={BATCH_OPTIONS}
          value={effective as (typeof BATCH_OPTIONS)[number]}
          onChange={setBatchSize}
          lockedOptions={pro ? undefined : [50, 100]}
          onLockedPress={() => router.push({ pathname: '/paywall', params: { context: 'batch' } })}
        />
      </View>
    </SettingsRow>
  );
}

const APPEARANCE_OPTIONS = ['System', 'Light', 'Dark'] as const;
const APPEARANCE_VALUE: Record<(typeof APPEARANCE_OPTIONS)[number], Appearance> = {
  System: 'system',
  Light: 'light',
  Dark: 'dark',
};

/** System / Light / Dark — overrides the iPhone setting for this app. */
function AppearanceRow() {
  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearance = useSettingsStore((s) => s.setAppearance);
  const selected = APPEARANCE_OPTIONS.find((o) => APPEARANCE_VALUE[o] === appearance) ?? 'System';

  return (
    <SettingsRow
      icon="contrast"
      color="blue"
      label="Appearance"
      subtitle={appearance === 'system' ? 'Matches your iPhone' : undefined}
    >
      <View className="mt-3">
        <SegmentedControl
          variant="tint"
          options={APPEARANCE_OPTIONS}
          value={selected}
          onChange={(o) => {
            setAppearance(APPEARANCE_VALUE[o]);
            posthog.capture('setting_changed', { setting: 'appearance', value: APPEARANCE_VALUE[o] });
          }}
        />
      </View>
    </SettingsRow>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [authInProgress, setAuthInProgress] = useState(false);

  const faceIdEnabled = useSettingsStore((s) => s.faceIdEnabled);
  const setFaceIdEnabled = useSettingsStore((s) => s.setFaceIdEnabled);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const analyticsOptIn = useSettingsStore((s) => s.analyticsOptIn);
  const setAnalyticsOptIn = useSettingsStore((s) => s.setAnalyticsOptIn);

  const planState = usePlanStore();
  const setMockPro = usePlanStore((s) => s.setMockPro);
  const mockPro = planState.mockPro;
  const pro = isPro(planState);
  // A count carrying a past quotaDate is stale — the app derives it as 0, so the
  // stepper has to show 0 too or its first tap would look like it did nothing.
  const sessionsUsedToday =
    planState.quotaDate === toDateString(new Date()) ? planState.sessionsUsedToday : 0;

  const index = useGalleryStore((s) => s.index);

  const appVersion = Application.nativeApplicationVersion ?? '—';

  // ── Face ID toggle ──────────────────────────────────────────────────────────

  async function handleFaceIdToggle(value: boolean) {
    if (value) {
      // Enabling: require auth first
      const supported = await LocalAuthentication.hasHardwareAsync();
      if (!supported) {
        Alert.alert('Not Available', 'Face ID is not available on this device.');
        return;
      }
      setAuthInProgress(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm your identity to enable Face ID lock',
        fallbackLabel: 'Use Passcode',
      });
      setAuthInProgress(false);
      if (result.success) {
        setFaceIdEnabled(true);
        posthog.capture('setting_changed', { setting: 'face_id', value: true });
      }
      // If cancelled/failed, leave toggle off
    } else {
      // Disabling: no auth required
      setFaceIdEnabled(false);
      posthog.capture('setting_changed', { setting: 'face_id', value: false });
    }
  }

  // ── Notifications toggle ────────────────────────────────────────────────────

  async function handleNotificationsToggle(value: boolean) {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notifications Are Off',
          'To get On This Day reminders, allow notifications for Swipe Photos in Settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      setNotificationsEnabled(true);
      scheduleOnThisDayNotification(index).catch(() => {});
      posthog.capture('setting_changed', { setting: 'notifications', value: true });
    } else {
      setNotificationsEnabled(false);
      cancelOnThisDayNotification().catch(() => {});
      posthog.capture('setting_changed', { setting: 'notifications', value: false });
    }
  }

  return (
    <View className="flex-1">
      <ScreenBackground />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BackCircle />
        <Text className="font-display text-fg text-[34px] leading-[37px] mt-3 mb-[22px]">Settings</Text>

        {/* Plan */}
        <Section title="Plan">
          <SettingsRow
            icon="sparkle"
            color="amber"
            label="Swipe Photos Pro"
            value={pro ? 'Active' : undefined}
            onPress={() => {
              if (pro) {
                // Manage/cancel lives in Apple's subscription sheet
                manageSubscriptions();
              } else {
                router.push({ pathname: '/paywall', params: { context: 'settings' } });
              }
            }}
          />
          <RowDivider />
          <SettingsRow
            icon="restore"
            color="blue"
            label="Restore Purchases"
            onPress={async () => {
              const restored = await restore();
              Alert.alert(
                restored ? 'Purchases Restored' : 'Nothing to Restore',
                restored
                  ? 'Swipe Photos Pro is active again.'
                  : 'No active subscription was found for this Apple ID.',
              );
            }}
          />
        </Section>

        {/* Review Preferences */}
        <Section title="Review">
          <BatchSizeRow />
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <AppearanceRow />
        </Section>

        {/* Privacy & Security */}
        <Section title="Privacy & Security">
          <SettingsRow
            icon="lock"
            color="teal"
            label="Face ID Lock"
            subtitle="Require Face ID before deleting photos"
            right={
              <Toggle
                value={faceIdEnabled}
                onValueChange={handleFaceIdToggle}
                disabled={authInProgress}
                accessibilityLabel="Face ID Lock"
              />
            }
          />
          <RowDivider />
          <SettingsRow
            icon="chart"
            color="sky"
            label="Share Analytics"
            subtitle="Anonymous usage and crash reports. Never your photos."
            right={
              <Toggle
                value={analyticsOptIn}
                accessibilityLabel="Share Analytics"
                onValueChange={(v) => {
                  posthog.capture('setting_changed', { setting: 'analytics', value: v });
                  setAnalyticsOptIn(v);
                }}
              />
            }
          />
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <SettingsRow
            icon="bell"
            color="amber"
            label="On This Day"
            subtitle="Daily reminder at 9:00 AM"
            right={
              <Toggle
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                accessibilityLabel="On This Day reminder"
              />
            }
          />
        </Section>

        {/* About */}
        <Section title="About">
          {/* Hidden until the App Store ID exists — a placeholder link is a broken feature */}
          {!!APP_STORE_ID && (
            <>
              <SettingsRow
                icon="star"
                color="amber"
                label="Rate Swipe Photos"
                onPress={() => {
                  Linking.openURL(`itms-apps://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`).catch(() => {});
                }}
              />
              <RowDivider />
            </>
          )}
          <SettingsRow
            icon="help"
            color="rose"
            label="Help & Support"
            onPress={() => {
              WebBrowser.openBrowserAsync(LEGAL.supportUrl).catch(() => {});
            }}
          />
          <RowDivider />
          <SettingsRow
            icon="shield"
            color="blue"
            label="Privacy Policy"
            onPress={() => {
              WebBrowser.openBrowserAsync(LEGAL.privacyUrl).catch(() => {});
            }}
          />
          <RowDivider />
          <SettingsRow
            icon="document"
            color="blue"
            label="Terms of Use"
            onPress={() => {
              WebBrowser.openBrowserAsync(LEGAL.termsUrl).catch(() => {});
            }}
          />
          <RowDivider />
          <SettingsRow icon="info" color="sky" label="Version" value={appVersion} />
        </Section>

        {/* Developer — development builds only; see DEV_TOOLS_ENABLED */}
        {DEV_TOOLS_ENABLED && (
          <Section title="Developer">
            <SettingsRow
              icon="wrench"
              color="rose"
              label="Mock Pro entitlement"
              subtitle="Simulate an active subscription"
              right={<Toggle value={mockPro} onValueChange={setMockPro} accessibilityLabel="Mock Pro entitlement" />}
            />
            <RowDivider />
            <SettingsRow
              icon="hourglass"
              color="amber"
              label="Use up free sessions"
              subtitle={`Sessions used today, of ${FREE_PLAN.sessionsPerDay} free`}
              right={
                <Stepper
                  label="Use up free sessions"
                  value={sessionsUsedToday}
                  min={0}
                  max={FREE_PLAN.sessionsPerDay}
                  onChange={(next) => usePlanStore.getState().setSessionsUsedToday(next)}
                />
              }
            />
            <RowDivider />
            <SettingsRow
              icon="restore"
              color="teal"
              label="Reset onboarding"
              onPress={() => {
                storage.remove(STORAGE_KEYS.hasCompletedOnboarding);
                router.replace('/onboarding');
              }}
            />
          </Section>
        )}
      </ScrollView>
      <StatusBarScrim />
    </View>
  );
}
