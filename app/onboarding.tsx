import { useState } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { createMMKV } from 'react-native-mmkv';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/glass/GlassCard';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { GradientPillButton } from '@/components/ui/GradientPillButton';
import { usePermissions } from '@/hooks/usePermissions';
import { STORAGE_KEYS } from '@/constants/config';
import { GRADIENTS, SPRING } from '@/constants/theme';
import { posthog } from '@/lib/posthog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const storage = createMMKV();

const STEPS = [
  {
    title: 'Reclaim your\nphone storage',
    subtitle: 'Breeze through thousands of photos. Swipe left to delete, right to keep.',
  },
  {
    icon: 'swap-horizontal' as const,
    title: 'Swipe to\ndecide',
    subtitle: 'Left to delete. Right to keep. Review by year, month, screenshots, videos, and more.',
  },
  {
    icon: 'lock-closed' as const,
    title: 'Private by\ndesign',
    subtitle: 'Everything stays on your device. No uploads, no accounts, no cloud.',
  },
];

// ─── Fanned photo-card stack (step 1 hero) ───────────────────────────────────
// Onboarding runs pre-permission, so no library photos exist yet — the cards
// are gradient placeholders in the app's aurora palette.

const CARD_W = 160;
const CARD_H = 214;

const FAN_CARDS = [
  {
    colors: ['#BF5AF2', '#5E5CE6'] as const,
    style: { left: 8, top: 18, transform: [{ rotate: '-10deg' }], opacity: 0.7 },
    border: 'rgba(255,255,255,0.25)',
  },
  {
    colors: ['#0A84FF', '#64D2FF'] as const,
    style: { right: 4, top: 10, transform: [{ rotate: '9deg' }], opacity: 0.85 },
    border: 'rgba(255,255,255,0.25)',
  },
  {
    colors: ['#5E5CE6', '#0A84FF'] as const,
    style: { left: 30, top: 0 },
    border: 'rgba(255,255,255,0.35)',
  },
];

function FannedStack() {
  return (
    <View className="mb-10" style={{ width: 220, height: 250 }}>
      {FAN_CARDS.map((card, i) => (
        <LinearGradient
          key={i}
          colors={card.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            {
              position: 'absolute',
              width: CARD_W,
              height: CARD_H,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: card.border,
              shadowColor: '#000',
              shadowOpacity: 0.5,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 16 },
            },
            card.style,
          ]}
        />
      ))}
      {/* Keep badge */}
      <View
        className="absolute items-center justify-center rounded-full"
        style={{
          right: 10,
          bottom: 0,
          width: 52,
          height: 52,
          backgroundColor: 'rgba(48,209,88,0.92)',
          shadowColor: '#30D158',
          shadowOpacity: 0.4,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 12 },
        }}
      >
        <Ionicons name="checkmark" size={26} color="white" />
      </View>
      {/* Delete badge */}
      <View
        className="absolute items-center justify-center rounded-full"
        style={{
          left: -6,
          bottom: 26,
          width: 44,
          height: 44,
          backgroundColor: 'rgba(255,69,58,0.92)',
          shadowColor: '#FF453A',
          shadowOpacity: 0.4,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 12 },
        }}
      >
        <Ionicons name="trash-outline" size={20} color="white" />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { isMediaGranted, requestMedia, requestNotifications } = usePermissions();

  // useState so React re-renders on step change (dots + button label update)
  const [currentStep, setCurrentStep] = useState(0);
  // useSharedValue only drives the slide animation
  const slideOffset = useSharedValue(0);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -slideOffset.value * SCREEN_WIDTH }],
  }));

  const isLastStep = currentStep === STEPS.length - 1;

  function goNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = currentStep + 1;
    setCurrentStep(next);
    slideOffset.value = withSpring(next, SPRING.modal);
  }

  async function handleFinish() {
    if (!isMediaGranted) {
      const result = await requestMedia();
      if (!result?.granted) return;
    }
    // Notifications optional — don't block on denial
    await requestNotifications();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    storage.set(STORAGE_KEYS.hasCompletedOnboarding, true);
    posthog.capture('onboarding_completed');
    router.replace('/(tabs)');
  }

  return (
    <View
      className="flex-1 bg-bg-dark"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <AuroraBackground variant="onboarding" />

      {/* Slides */}
      <View className="flex-1 overflow-hidden">
        <Animated.View
          className="flex-row flex-1"
          style={[{ width: SCREEN_WIDTH * STEPS.length }, slideStyle]}
        >
          {STEPS.map((s, i) => (
            <View
              key={i}
              className="items-center justify-center px-8"
              style={{ width: SCREEN_WIDTH }}
            >
              {/* Hero: fanned card stack on step 1, glass icon on later steps */}
              {i === 0 ? (
                <FannedStack />
              ) : (
                <View className="w-24 h-24 rounded-full bg-white/[0.07] border border-white/[0.14] items-center justify-center mb-9">
                  <Ionicons name={s.icon!} size={40} color="white" />
                </View>
              )}

              {/* Title */}
              <Text
                className="text-white font-extrabold text-center mb-4"
                style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1 }}
              >
                {s.title}
              </Text>

              {/* Subtitle */}
              <Text
                className="text-white/55 text-[17px] text-center"
                style={{ lineHeight: 26, maxWidth: 300 }}
              >
                {s.subtitle}
              </Text>

              {/* Feature highlights on step 2 */}
              {i === 1 && (
                <View className="mt-10 gap-3 w-full">
                  {[
                    { icon: '📅', label: 'By year, month, or On This Day' },
                    { icon: '📸', label: 'Screenshots & videos sorted for you' },
                    { icon: '✅', label: 'Kept photos never show up again' },
                  ].map((f) => (
                    <GlassCard key={f.label} className="flex-row items-center gap-3 p-3">
                      <Text className="text-2xl">{f.icon}</Text>
                      <Text className="text-white/80 text-base flex-1">{f.label}</Text>
                    </GlassCard>
                  ))}
                </View>
              )}
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Bottom controls */}
      <View className="px-8 pb-6 gap-[18px]">
        {/* Step dots */}
        <View className="flex-row justify-center items-center gap-2">
          {STEPS.map((_, i) =>
            i === currentStep ? (
              <LinearGradient
                key={i}
                colors={GRADIENTS.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: 26, height: 6, borderRadius: 999 }}
              />
            ) : (
              <View key={i} className="w-1.5 h-1.5 rounded-full bg-white/25" />
            ),
          )}
        </View>

        {/* Primary CTA */}
        <GradientPillButton
          label={isLastStep ? 'Allow Photo Access' : 'Continue'}
          onPress={isLastStep ? handleFinish : goNext}
        />

        {/* Skip (last step only) */}
        {isLastStep && (
          <Pressable onPress={() => { posthog.capture('onboarding_skipped'); router.replace('/(tabs)'); }} className="items-center py-2">
            <Text className="text-white/40 text-sm">Skip for now</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
