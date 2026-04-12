import { useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { SPRING, SWIPE } from '@/constants/theme';
import { ActionOverlay } from './ActionOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

interface SwipeCardProps {
  uri: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onDoubleTap: () => void;
  stackIndex: number; // 0 = top (interactive), 1/2 = background
}

function triggerHaptic(style: Haptics.ImpactFeedbackStyle) {
  Haptics.impactAsync(style);
}

export function SwipeCard({
  uri,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onDoubleTap,
  stackIndex,
}: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const hasPassedThreshold = useSharedValue(false);

  const isTopCard = stackIndex === 0;
  const isDeparting = stackIndex === -1;

  // Animated stack position — spring into new position when stackIndex changes (promote effect)
  // Use stackIndex 0 values as fallback for departing card (it won't animate, just retains fly-off)
  const resolvedIndex = isDeparting ? 0 : stackIndex;
  const animScale = useSharedValue(SWIPE.stackScale[resolvedIndex] ?? 1);
  const animOffsetY = useSharedValue(SWIPE.stackOffsetY[resolvedIndex] ?? 0);
  const animOpacity = useSharedValue(SWIPE.stackOpacity[resolvedIndex] ?? 1);

  useEffect(() => {
    // Departing card: skip stack promotion — it retains its fly-off translateX/Y
    if (isDeparting) return;
    animScale.value = withSpring(SWIPE.stackScale[stackIndex] ?? 1, SPRING.promote);
    animOffsetY.value = withSpring(SWIPE.stackOffsetY[stackIndex] ?? 0, SPRING.promote);
    animOpacity.value = withTiming(SWIPE.stackOpacity[stackIndex] ?? 1, { duration: 220 });
  }, [stackIndex, isDeparting, animScale, animOffsetY, animOpacity]);

  const pan = Gesture.Pan()
    .enabled(isTopCard)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;

      const crossed = Math.abs(e.translationX) > SWIPE.thresholdPx;
      if (crossed && !hasPassedThreshold.value) {
        hasPassedThreshold.value = true;
        scheduleOnRN(triggerHaptic, Haptics.ImpactFeedbackStyle.Medium);
      } else if (!crossed) {
        hasPassedThreshold.value = false;
      }
    })
    .onEnd((e) => {
      const swipedLeft =
        e.translationX < -SWIPE.thresholdPx ||
        (e.translationX < -SWIPE.thresholdPx * 0.5 && e.velocityX < -SWIPE.velocityThresholdX);
      const swipedRight =
        e.translationX > SWIPE.thresholdPx ||
        (e.translationX > SWIPE.thresholdPx * 0.5 && e.velocityX > SWIPE.velocityThresholdX);
      const swipedUp =
        e.translationY < -SWIPE.upThresholdPx &&
        Math.abs(e.translationX) < SWIPE.thresholdPx;

      if (swipedLeft) {
        scheduleOnRN(onSwipeLeft);
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, SPRING.flyOff);
      } else if (swipedRight) {
        scheduleOnRN(onSwipeRight);
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, SPRING.flyOff);
      } else if (swipedUp) {
        scheduleOnRN(onSwipeUp);
        translateY.value = withSpring(-SCREEN_HEIGHT, SPRING.flyOff);
      } else {
        // Snap back with spring overshoot
        translateX.value = withSpring(0, SPRING.snappy);
        translateY.value = withSpring(0, SPRING.snappy);
        hasPassedThreshold.value = false;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(isTopCard)
    .onEnd(() => {
      scheduleOnRN(onDoubleTap);
    });

  // Race: pan activates immediately, doubleTap wins on second tap
  const composed = Gesture.Race(doubleTap, pan);

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-0.15, 0, 0.15],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}rad` },
        { scale: animScale.value },
      ],
      opacity: animOpacity.value,
      top: animOffsetY.value,
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        className="absolute rounded-3xl overflow-hidden"
        pointerEvents={isDeparting ? 'none' : 'auto'}
        style={[{ width: SCREEN_WIDTH - 48, height: CARD_HEIGHT, left: 24 }, cardStyle]}
      >
        <Image
          source={{ uri }}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={200}
          recyclingKey={uri}
        />
        {isTopCard && (
          <ActionOverlay translateX={translateX} translateY={translateY} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}
