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
import { GlassCard } from '@/components/glass/GlassCard';
import { usePermissions } from '@/hooks/usePermissions';
import { STORAGE_KEYS } from '@/constants/config';
import { SPRING } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const storage = createMMKV();

const STEPS = [
  {
    emoji: '🗂️',
    title: 'Reclaim your\nphone storage',
    subtitle: 'Swipe Photos helps you breeze through thousands of photos and delete what you no longer need.',
  },
  {
    emoji: '👆',
    title: 'Swipe to\ndecide',
    subtitle: 'Left to delete. Right to keep. Review by year, month, screenshots, videos, and more.',
  },
  {
    emoji: '🔒',
    title: 'Private by\ndesign',
    subtitle: 'Everything stays on your device. No uploads, no accounts, no cloud.',
  },
];

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
    router.replace('/(tabs)');
  }

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
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
              {/* Emoji */}
              <Text className="text-8xl mb-8">{s.emoji}</Text>

              {/* Title */}
              <Text
                className="text-white font-bold text-center mb-4"
                style={{ fontSize: 40, lineHeight: 48 }}
              >
                {s.title}
              </Text>

              {/* Subtitle */}
              <Text className="text-white/60 text-lg leading-7 text-center">
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
      <View className="px-8 pb-6 gap-4">
        {/* Step dots */}
        <View className="flex-row justify-center gap-2 mb-2">
          {STEPS.map((_, i) => (
            <View
              key={i}
              className="h-1.5 rounded-full bg-white"
              style={{
                width: i === currentStep ? 24 : 8,
                opacity: i === currentStep ? 1 : 0.3,
              }}
            />
          ))}
        </View>

        {/* Primary CTA */}
        <Pressable
          onPress={isLastStep ? handleFinish : goNext}
          className="bg-white rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-black font-semibold text-lg">
            {isLastStep ? 'Allow Photo Access' : 'Continue'}
          </Text>
        </Pressable>

        {/* Skip (last step only) */}
        {isLastStep && (
          <Pressable onPress={() => router.replace('/(tabs)')} className="items-center py-2">
            <Text className="text-white/40 text-sm">Skip for now</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
