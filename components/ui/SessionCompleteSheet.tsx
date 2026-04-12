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
import { useSpringPress } from '@/hooks/useSpringPress';
import { SPRING } from '@/constants/theme';

import confettiSource from '@/assets/animations/confetti.json';

interface SessionCompleteSheetProps {
  totalCount: number;
  stagedCount: number;
  keptCount: number;
  favoritedCount: number;
  onDone: () => void;
  // When false the "Review Trash" button is hidden (e.g. summary shown after trash is already done)
  showReviewTrash?: boolean;
  onReviewTrash?: () => void;
}

// ─── Staggered stat ───────────────────────────────────────────────────────────

function AnimatedStat({ label, value, delay }: { label: string; value: number; delay: number }) {
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
    <Animated.View style={style} className="items-center flex-1">
      <Text className="text-white text-2xl font-bold">{value}</Text>
      <Text className="text-white/50 text-xs mt-0.5">{label}</Text>
    </Animated.View>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export function SessionCompleteSheet({
  totalCount,
  stagedCount,
  keptCount,
  favoritedCount,
  onDone,
  showReviewTrash = true,
  onReviewTrash,
}: SessionCompleteSheetProps) {
  const lottieRef = useRef<LottieView>(null);

  const sheetOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(50);
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.82);

  const { animatedStyle: trashBtnStyle, onPressIn: trashIn, onPressOut: trashOut } = useSpringPress(0.96);
  const { animatedStyle: doneBtnStyle, onPressIn: doneIn, onPressOut: doneOut } = useSpringPress(0.96);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    lottieRef.current?.play();

    sheetOpacity.value = withTiming(1, { duration: 280 });
    sheetTranslateY.value = withSpring(0, SPRING.modal);
    titleOpacity.value = withDelay(180, withTiming(1, { duration: 300 }));
    titleScale.value = withDelay(180, withSpring(1, { damping: 16, stiffness: 260 }));
  }, [sheetOpacity, sheetTranslateY, titleOpacity, titleScale]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  return (
    <View className="absolute inset-0 justify-end bg-black/80 mb-10">
      {/* Full-screen confetti behind the sheet */}
      <LottieView
        ref={lottieRef}
        source={confettiSource}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        resizeMode="contain"
        loop={false}
        autoPlay={false}
      />

      {/* Sheet */}
      <Animated.View style={sheetStyle}>
        <GlassSheet>
          {/* Title */}
          <Animated.View style={titleStyle} className="items-center mb-5">
            <Text className="text-white text-3xl font-bold">All Done!</Text>
            <Text className="text-white/50 text-sm mt-1">
              {totalCount} photo{totalCount === 1 ? '' : 's'} reviewed
            </Text>
          </Animated.View>

          {/* Stats row — staggered in */}
          <View className="flex-row justify-around mb-6">
            <AnimatedStat label="To Delete" value={stagedCount} delay={200} />
            <View className="w-px bg-white/10" />
            <AnimatedStat label="Kept" value={keptCount} delay={310} />
            <View className="w-px bg-white/10" />
            <AnimatedStat label="Favorited" value={favoritedCount} delay={420} />
          </View>

          {/* CTAs */}
          {showReviewTrash && stagedCount > 0 && (
            <Animated.View style={trashBtnStyle}>
              <Pressable
                onPress={onReviewTrash}
                onPressIn={trashIn}
                onPressOut={trashOut}
                className="bg-red-500/80 rounded-2xl py-4 items-center mb-3"
              >
                <Text className="text-white font-semibold text-base">
                  Review Trash ({stagedCount})
                </Text>
              </Pressable>
            </Animated.View>
          )}

          <Animated.View style={doneBtnStyle}>
            <Pressable
              onPress={onDone}
              onPressIn={doneIn}
              onPressOut={doneOut}
              className="bg-gray-500/80 rounded-2xl py-4 items-center mb-3"
            >
              <Text className="text-white text-base">
                {showReviewTrash && stagedCount > 0 ? 'Done' : 'Back to Home'}
              </Text>
            </Pressable>
          </Animated.View>
        </GlassSheet>
      </Animated.View>
    </View>
  );
}
