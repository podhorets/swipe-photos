import { useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassSheet } from '@/components/glass/GlassSheet';
import { formatBytes } from '@/lib/dateUtils';
import { AVG_PHOTO_SIZE_BYTES } from '@/constants/config';

const confettiSource = require('@/assets/animations/confetti.json');

interface SessionCompleteSheetProps {
  totalCount: number;
  stagedCount: number;
  keptCount: number;
  favoritedCount: number;
  onReviewTrash: () => void;
  onDone: () => void;
}

function AnimatedStat({
  label,
  value,
  delay,
}: {
  label: string;
  value: string | number;
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 200 }));
  }, [delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={style} className="items-center">
      <Text className="text-white text-2xl font-bold">{value}</Text>
      <Text className="text-white/50 text-xs mt-0.5">{label}</Text>
    </Animated.View>
  );
}

export function SessionCompleteSheet({
  totalCount,
  stagedCount,
  keptCount,
  favoritedCount,
  onReviewTrash,
  onDone,
}: SessionCompleteSheetProps) {
  const lottieRef = useRef<LottieView>(null);
  const sheetOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(40);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    lottieRef.current?.play();

    sheetOpacity.value = withTiming(1, { duration: 300 });
    sheetTranslateY.value = withSpring(0, { damping: 20, stiffness: 180 });
  }, [sheetOpacity, sheetTranslateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const estimatedSavings = formatBytes(stagedCount * AVG_PHOTO_SIZE_BYTES);

  return (
    <View className="absolute inset-0 justify-end">
      {/* Confetti layer behind the sheet */}
      <LottieView
        ref={lottieRef}
        source={confettiSource}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 200 }}
        resizeMode="cover"
        loop={false}
        autoPlay={false}
      />

      {/* Dim overlay */}
      <View className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <Animated.View style={sheetStyle}>
        <GlassSheet>
          {/* Title */}
          <View className="items-center mb-5">
            <Text className="text-white text-3xl font-bold">All Done!</Text>
            <Text className="text-white/50 text-sm mt-1">
              {totalCount} photos reviewed
            </Text>
          </View>

          {/* Stats row */}
          <View className="flex-row justify-around mb-6">
            <AnimatedStat label="To Delete" value={stagedCount} delay={150} />
            <View className="w-px bg-white/10" />
            <AnimatedStat label="Kept" value={keptCount} delay={250} />
            <View className="w-px bg-white/10" />
            <AnimatedStat label="Favorited" value={favoritedCount} delay={350} />
          </View>

          {/* Savings estimate */}
          {stagedCount > 0 && (
            <View className="bg-white/10 rounded-2xl px-4 py-3 mb-5 items-center">
              <Text className="text-white/40 text-xs">Estimated savings</Text>
              <Text className="text-white font-bold text-lg">{estimatedSavings}</Text>
            </View>
          )}

          {/* CTAs */}
          {stagedCount > 0 ? (
            <Pressable
              onPress={onReviewTrash}
              className="bg-red-500/80 rounded-2xl py-4 items-center mb-3 active:opacity-70"
            >
              <Text className="text-white font-semibold text-base">
                Review Trash ({stagedCount})
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onDone}
            className="py-3 items-center active:opacity-60"
          >
            <Text className="text-white/60 text-base">
              {stagedCount > 0 ? 'Done' : 'Back to Home'}
            </Text>
          </Pressable>
        </GlassSheet>
      </Animated.View>
    </View>
  );
}
