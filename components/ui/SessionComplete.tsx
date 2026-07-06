import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard } from '@/components/glass/GlassCard';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { GradientText } from '@/components/ui/GradientText';
import { GradientPillButton } from '@/components/ui/GradientPillButton';
import { useStreakStore } from '@/stores/streakStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { computeStreak } from '@/lib/streakUtils';
import { getOnThisDay, getScreenshots, getVideos } from '@/lib/gallery/grouper';
import { GRADIENTS, SPRING } from '@/constants/theme';
import { formatBytes } from '@/lib/dateUtils';

import confettiSource from '@/assets/animations/confetti.json';

const SCREEN_WIDTH = Dimensions.get('window').width;
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
  amber = false,
}: {
  label: string;
  value: string;
  delay: number;
  amber?: boolean;
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
      <GlassCard noBlur radius={20}>
        <View className="py-4 items-center">
          <Text className={`text-2xl font-extrabold ${amber ? 'text-streak' : 'text-white'}`}>
            {value}
          </Text>
          <Text className="text-white/45 text-xs font-semibold mt-0.5">{label}</Text>
        </View>
      </GlassCard>
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
    <View className="absolute inset-0 bg-bg-dark">
      <AuroraBackground variant="success" />

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
          style={[
            checkStyle,
            {
              backgroundColor: 'rgba(48,209,88,0.15)',
              borderWidth: 1.5,
              borderColor: 'rgba(48,209,88,0.5)',
              shadowColor: '#30D158',
              shadowOpacity: 0.3,
              shadowRadius: 60,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
          className="w-[84px] h-[84px] rounded-full items-center justify-center mb-[26px]"
        >
          <Ionicons name="checkmark" size={40} color="#30D158" />
        </Animated.View>

        <Text className="text-white text-[32px] font-extrabold" style={{ letterSpacing: -0.7 }}>
          All done!
        </Text>
        <Text className="text-white/50 text-[15px] mt-1.5">
          You reviewed {totalCount} photo{totalCount === 1 ? '' : 's'}
        </Text>

        {/* Hero freed storage — gradient count-up */}
        {hasFreed && (
          <View className="items-center mt-[30px] mb-1">
            <GradientText
              text={formatBytes(displayBytes)}
              fontSize={56}
              width={SCREEN_WIDTH - 56}
              colors={GRADIENTS.freed}
            />
            <Text className="text-white/55 text-[15px] font-semibold mt-0.5">storage freed</Text>
          </View>
        )}

        {/* Stat cards */}
        <View className="flex-row gap-3 w-full mt-8 mb-9">
          <StatCard label="Kept" value={keptCount.toLocaleString()} delay={200} />
          <StatCard
            label="Deleted"
            value={(totalCount - keptCount).toLocaleString()}
            delay={310}
          />
          <StatCard label="Day streak" value={`🔥 ${streak}`} delay={420} amber />
        </View>

        <View className="w-full">
          <GradientPillButton label="Back to Library" onPress={onDone} />
        </View>

        {suggestion && (
          <Text className="text-white/40 text-sm font-medium mt-[18px]">{suggestion}</Text>
        )}
      </Animated.View>
    </View>
  );
}
