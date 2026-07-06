import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import * as Application from 'expo-application';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '@/stores/settingsStore';
import { cancelOnThisDayNotification, scheduleOnThisDayNotification } from '@/lib/notifications';
import { useGalleryStore } from '@/stores/galleryStore';
import { GlassCard } from '@/components/glass/GlassCard';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { IconSquircle } from '@/components/ui/IconSquircle';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { GRADIENTS } from '@/constants/theme';
import { posthog } from '@/lib/posthog';

const BATCH_OPTIONS = [25, 50, 100] as const;

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text
        className="text-white/40 text-xs font-bold uppercase px-1.5 mb-2"
        style={{ letterSpacing: 1.44 }}
      >
        {title}
      </Text>
      <GlassCard noBlur radius={22}>
        {children}
      </GlassCard>
    </View>
  );
}

// ─── Row variants ─────────────────────────────────────────────────────────────

function RowDivider() {
  return <View className="h-px bg-white/10 mx-4" />;
}

function ToggleRow({
  icon,
  gradient,
  label,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  gradient: readonly [string, string];
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center px-4 py-[13px] gap-3">
      <IconSquircle icon={icon} colors={gradient} />
      <View className="flex-1">
        <Text className="text-white text-base font-medium">{label}</Text>
        {subtitle && <Text className="text-white/40 text-xs mt-px">{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#30D158' }}
        thumbColor="white"
      />
    </View>
  );
}

function NavRow({
  icon,
  gradient,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  gradient: readonly [string, string];
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-[13px] gap-3 active:opacity-60"
    >
      <IconSquircle icon={icon} colors={gradient} />
      <Text className="text-white text-base font-medium flex-1">{label}</Text>
      {value && <Text className="text-white/40 text-[15px] mr-2">{value}</Text>}
      <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.3)" />
    </Pressable>
  );
}

function BatchSizeRow() {
  const batchSize = useSettingsStore((s) => s.batchSize);
  const setBatchSize = useSettingsStore((s) => s.setBatchSize);

  return (
    <View className="px-4 py-3.5">
      <View className="flex-row items-center mb-3 gap-3">
        <IconSquircle icon="shuffle" colors={GRADIENTS.accent} />
        <Text className="text-white text-base font-medium flex-1">Random batch size</Text>
      </View>
      <SegmentedControl
        options={BATCH_OPTIONS}
        value={batchSize as (typeof BATCH_OPTIONS)[number]}
        onChange={setBatchSize}
      />
    </View>
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
          'Permission Required',
          'Enable notifications in Settings > Swipe Photos > Notifications.',
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
    <View className="flex-1 bg-bg-dark">
      <AuroraBackground variant="settings" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 110,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          className="text-white text-[34px] font-extrabold mb-[22px]"
          style={{ letterSpacing: -0.8 }}
        >
          Settings
        </Text>

        {/* Review Preferences */}
        <Section title="Review">
          <BatchSizeRow />
        </Section>

        {/* Privacy & Security */}
        <Section title="Privacy & Security">
          <ToggleRow
            icon="lock-closed"
            gradient={GRADIENTS.faceId}
            label="Face ID Lock"
            subtitle="Require Face ID before deleting photos"
            value={faceIdEnabled}
            onValueChange={handleFaceIdToggle}
            disabled={authInProgress}
          />
          <RowDivider />
          <ToggleRow
            icon="bar-chart"
            gradient={GRADIENTS.analytics}
            label="Analytics"
            subtitle="Help improve the app (anonymous)"
            value={analyticsOptIn}
            onValueChange={(v) => {
              posthog.capture('setting_changed', { setting: 'analytics', value: v });
              setAnalyticsOptIn(v);
            }}
          />
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <ToggleRow
            icon="notifications"
            gradient={GRADIENTS.notify}
            label="On This Day"
            subtitle="Daily reminder at 9:00 AM"
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
          />
        </Section>

        {/* About */}
        <Section title="About">
          <NavRow
            icon="star"
            gradient={GRADIENTS.star}
            label="Rate Swipe Photos"
            onPress={() => {
              WebBrowser.openBrowserAsync('https://apps.apple.com').catch(() => {});
            }}
          />
          <RowDivider />
          <NavRow
            icon="shield-checkmark"
            gradient={GRADIENTS.shield}
            label="Privacy Policy"
            onPress={() => {
              WebBrowser.openBrowserAsync('https://swipephotos.app/privacy').catch(() => {});
            }}
          />
          <RowDivider />
          <View className="flex-row items-center px-4 py-[13px] gap-3">
            <IconSquircle icon="information-circle" />
            <Text className="text-white text-base font-medium flex-1">Version</Text>
            <Text className="text-white/40 text-[15px]">{appVersion}</Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}
