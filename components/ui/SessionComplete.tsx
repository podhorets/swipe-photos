import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useStreakStore } from '@/stores/streakStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { computeStreak } from '@/lib/streakUtils';
import { getOnThisDay, getScreenshots, getVideos } from '@/lib/gallery/grouper';
import { SPRING } from '@/constants/theme';
import { formatBytes } from '@/lib/dateUtils';

import confettiSource from '@/assets/animations/confetti.json';

const COUNT_UP_MS = 900;

interface SessionCompleteProps {
  totalCount: number;
  keptCount: number;
  freedBytes?: number;
  onDone: () => void;
}

// ─── Staggered stat card ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  delay,
  tone,
}: {
  label: string;
  value: string;
  delay: number;
  /** Kept reads in keep green, the streak in streak amber */
  tone?: 'keep' | 'streak';
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 320 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 220 }));
  }, [delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={style} className="flex-1">
      <Card radius={20} className="py-4 items-center">
        <Text
          className={`font-display text-[24px] ${
            tone === 'keep' ? 'text-keep-text' : tone === 'streak' ? 'text-streak-fg' : 'text-fg'
          }`}
        >
          {value}
        </Text>
        <Text className="text-fg-2 text-xs font-semibold mt-0.5">{label}</Text>
      </Card>
    </Animated.View>
  );
}

// ─── Full-screen completion ───────────────────────────────────────────────────

export function SessionComplete({
  totalCount,
  keptCount,
  freedBytes,
  onDone,
}: SessionCompleteProps) {
  const t = useTheme();
  const lottieRef = useRef<LottieView>(null);
  const hasFreed = freedBytes !== undefined && freedBytes > 0;

  // Count-up for the hero freed number — JS-driven; this is a static
  // celebration screen so ~30fps state updates are fine.
  const [displayBytes, setDisplayBytes] = useState(0);
  useEffect(() => {
    if (!hasFreed) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayBytes(Math.round(freedBytes * eased));
      if (t >= 1) clearInterval(timer);
    }, 33);
    return () => clearInterval(timer);
  }, [hasFreed, freedBytes]);

  const streak = useMemo(
    () => computeStreak(useStreakStore.getState().completedDates, new Date()),
    [],
  );

  // Suggestion: category with the most unreviewed items left
  const suggestion = useMemo(() => {
    const index = useGalleryStore.getState().index;
    const keepIds = useKeepStore.getState().keepIds;
    const remaining = (assets: { id: string }[]) =>
      assets.filter((a) => !keepIds.has(a.id)).length;
    const candidates: [string, number][] = [
      ['Screenshots', remaining(getScreenshots(index))],
      ['Videos', remaining(getVideos(index))],
      ['On This Day', remaining(getOnThisDay(index))],
    ];
    candidates.sort((a, b) => b[1] - a[1]);
    const [label, count] = candidates[0];
    return count > 0 ? `Keep going — ${label} has ${count.toLocaleString()} left` : undefined;
  }, []);

  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(50);
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.7);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    lottieRef.current?.play();

    contentOpacity.value = withTiming(1, { duration: 280 });
    contentTranslateY.value = withSpring(0, SPRING.modal);
    checkOpacity.value = withDelay(120, withTiming(1, { duration: 300 }));
    checkScale.value = withDelay(120, withSpring(1, { damping: 16, stiffness: 260 }));
  }, [contentOpacity, contentTranslateY, checkOpacity, checkScale]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <View className="absolute inset-0 bg-screen">
      <ScreenBackground />

      {/* Full-screen confetti behind the content */}
      <LottieView
        ref={lottieRef}
        source={confettiSource}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        resizeMode="contain"
        loop={false}
        autoPlay={false}
      />

      <Animated.View style={contentStyle} className="flex-1 items-center justify-center px-7">
        {/* Check circle */}
        <Animated.View
          style={checkStyle}
          className="w-[84px] h-[84px] rounded-full items-center justify-center mb-[26px] bg-keep-tint border-2 border-keep-ring"
        >
          <Icon name="check" size={40} color={t.keep.icon} strokeWidth={2.6} />
        </Animated.View>

        <Text className="font-display text-fg text-[32px]">All done!</Text>
        <Text className="text-fg-2 text-[15px] mt-1.5">
          You reviewed {totalCount} photo{totalCount === 1 ? '' : 's'}
        </Text>

        {/* Hero freed storage — gradient count-up */}
        {hasFreed && (
          <View className="items-center mt-[30px] mb-1">
            <Text className="font-display text-keep-text text-[56px] leading-[64px]" style={{ fontVariant: ['tabular-nums'] }}>
              {formatBytes(displayBytes)}
            </Text>
            <Text className="text-fg-2 text-[15px] font-semibold mt-0.5">moved to Recently Deleted</Text>
            {/* Accurate claim (2.3.1): space comes back only once iOS purges them */}
            <Text className="text-fg-2 text-[12px] mt-1 text-center">
              Space is freed when Recently Deleted is emptied, or after 30 days.
            </Text>
          </View>
        )}

        {/* Stat cards */}
        <View className="flex-row gap-3 w-full mt-8 mb-9">
          <StatCard label="Kept" value={keptCount.toLocaleString()} delay={200} tone="keep" />
          <StatCard
            label="Deleted"
            value={(totalCount - keptCount).toLocaleString()}
            delay={310}
          />
          <StatCard label="Day streak" value={String(streak)} delay={420} tone="streak" />
        </View>

        <View className="w-full">
          <PrimaryButton label="Back to Library" onPress={onDone} />
        </View>

        {suggestion && (
          <Text className="text-fg-2 text-sm font-medium mt-[18px]">{suggestion}</Text>
        )}
      </Animated.View>
    </View>
  );
}
