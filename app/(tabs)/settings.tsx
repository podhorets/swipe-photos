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
import { BlurView } from 'expo-blur';
import { useSettingsStore } from '@/stores/settingsStore';
import { cancelOnThisDayNotification, scheduleOnThisDayNotification } from '@/lib/notifications';
import { useGalleryStore } from '@/stores/galleryStore';
import { GLASS } from '@/constants/theme';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-white/40 text-xs font-semibold uppercase tracking-widest px-2 mb-2">
        {title}
      </Text>
      <BlurView
        intensity={GLASS.intensity.light}
        tint={GLASS.tint}
        className="rounded-2xl overflow-hidden border border-white/10"
      >
        {children}
      </BlurView>
    </View>
  );
}

// ─── Row variants ─────────────────────────────────────────────────────────────

function RowDivider() {
  return <View className="h-px bg-white/10 mx-4" />;
}

function ToggleRow({
  icon,
  label,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center px-4 py-3.5">
      <Ionicons name={icon} size={20} color="rgba(255,255,255,0.6)" style={{ marginRight: 12 }} />
      <View className="flex-1">
        <Text className="text-white text-base">{label}</Text>
        {subtitle && <Text className="text-white/40 text-xs mt-0.5">{subtitle}</Text>}
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
  label,
  subtitle,
  value,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 active:opacity-60"
    >
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? '#FF3B30' : 'rgba(255,255,255,0.6)'}
        style={{ marginRight: 12 }}
      />
      <View className="flex-1">
        <Text className={destructive ? 'text-red-400 text-base' : 'text-white text-base'}>
          {label}
        </Text>
        {subtitle && <Text className="text-white/40 text-xs mt-0.5">{subtitle}</Text>}
      </View>
      {value && <Text className="text-white/40 text-sm mr-2">{value}</Text>}
      {!destructive && (
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
      )}
    </Pressable>
  );
}

function BatchSizeRow() {
  const batchSize = useSettingsStore((s) => s.batchSize);
  const setBatchSize = useSettingsStore((s) => s.setBatchSize);
  const options = [25, 50, 100];

  return (
    <View className="px-4 py-3.5">
      <View className="flex-row items-center mb-3">
        <Ionicons name="shuffle-outline" size={20} color="rgba(255,255,255,0.6)" style={{ marginRight: 12 }} />
        <Text className="text-white text-base flex-1">Random Batch Size</Text>
        <Text className="text-white/40 text-sm">{batchSize} photos</Text>
      </View>
      <View className="flex-row gap-2 pl-8">
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => setBatchSize(opt)}
            className="flex-1 py-2 rounded-xl items-center"
            style={{
              backgroundColor: batchSize === opt ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
            }}
          >
            <Text className={batchSize === opt ? 'text-white font-semibold' : 'text-white/50'}>
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
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
      }
      // If cancelled/failed, leave toggle off
    } else {
      // Disabling: no auth required
      setFaceIdEnabled(false);
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
    } else {
      setNotificationsEnabled(false);
      cancelOnThisDayNotification().catch(() => {});
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-white text-4xl font-bold mb-6">Settings</Text>

      {/* Review Preferences */}
      <Section title="Review Preferences">
        <BatchSizeRow />
      </Section>

      {/* Privacy & Security */}
      <Section title="Privacy & Security">
        <ToggleRow
          icon="lock-closed-outline"
          label="Face ID Lock"
          subtitle="Require Face ID before deleting photos"
          value={faceIdEnabled}
          onValueChange={handleFaceIdToggle}
          disabled={authInProgress}
        />
        <RowDivider />
        <ToggleRow
          icon="bar-chart-outline"
          label="Analytics"
          subtitle="Help improve the app (anonymous)"
          value={analyticsOptIn}
          onValueChange={setAnalyticsOptIn}
        />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <ToggleRow
          icon="notifications-outline"
          label="On This Day"
          subtitle="Daily reminder at 9:00 AM"
          value={notificationsEnabled}
          onValueChange={handleNotificationsToggle}
        />
      </Section>

      {/* About */}
      <Section title="About">
        <NavRow
          icon="star-outline"
          label="Rate Swipe Photos"
          onPress={() => {
            WebBrowser.openBrowserAsync('https://apps.apple.com').catch(() => {});
          }}
        />
        <RowDivider />
        <NavRow
          icon="shield-outline"
          label="Privacy Policy"
          onPress={() => {
            WebBrowser.openBrowserAsync('https://swipephotos.app/privacy').catch(() => {});
          }}
        />
        <RowDivider />
        <View className="flex-row items-center px-4 py-3.5">
          <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.6)" style={{ marginRight: 12 }} />
          <Text className="text-white/40 text-base flex-1">Version</Text>
          <Text className="text-white/40 text-base">{appVersion}</Text>
        </View>
      </Section>
    </ScrollView>
  );
}
