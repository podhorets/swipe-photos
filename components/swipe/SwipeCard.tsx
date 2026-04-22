import { useCallback, useEffect, useImperativeHandle } from 'react';
import type { Ref } from 'react';
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
import { gatedHaptic } from '@/lib/haptics';
import { ActionOverlay } from './ActionOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

export type SwipeDirection = 'left' | 'right';

export interface SwipeCardHandle {
  dismiss: (direction: SwipeDirection) => void;
}

interface SwipeCardProps {
  assetId: string;
  uri: string;
  sizeLabel?: string;
  onDecide: (assetId: string, direction: SwipeDirection) => void;
  onDoubleTap: () => void;
  stackIndex: number; // 0 = top (interactive), 1/2 = background, -1 = departing
  zIndex: number;     // explicit native layer order — top card always highest
  ref?: Ref<SwipeCardHandle>;
}

export function SwipeCard({
  assetId,
  uri,
  sizeLabel,
  onDecide,
  onDoubleTap,
  stackIndex,
  zIndex,
  ref,
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
    // Reset translate — critical for undo: the restored card's translateX/Y is still
    // at the fly-off position (±SCREEN_WIDTH * 1.5) and must spring back to centre.
    translateX.value = withSpring(0, SPRING.snappy);
    translateY.value = withSpring(0, SPRING.snappy);
  }, [stackIndex, isDeparting, animScale, animOffsetY, animOpacity, translateX, translateY]);

  // Unified dismiss path — used by both the gesture handler and the imperative
  // handle exposed to parents. Drives the fly-off spring AND advances session
  // state. Button and gesture paths converge here, so their visual behavior is
  // guaranteed identical.
  const dismiss = useCallback(
    (direction: SwipeDirection) => {
      const dist = direction === 'left' ? -SCREEN_WIDTH * 1.5 : SCREEN_WIDTH * 1.5;
      translateX.value = withSpring(dist, SPRING.flyOff);
      onDecide(assetId, direction);
      gatedHaptic(
        direction === 'left'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Medium,
      );
    },
    [assetId, onDecide, translateX],
  );

  useImperativeHandle(ref, () => ({ dismiss }), [dismiss]);

  const pan = Gesture.Pan()
    .enabled(isTopCard)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;

      const crossed = Math.abs(e.translationX) > SWIPE.thresholdPx;
      if (crossed && !hasPassedThreshold.value) {
        hasPassedThreshold.value = true;
        scheduleOnRN(gatedHaptic, Haptics.ImpactFeedbackStyle.Medium);
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

      if (swipedLeft) {
        // Set the spring synchronously in the worklet for instant UI-thread animation,
        // then schedule the JS-side decision + haptic.
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, SPRING.flyOff);
        scheduleOnRN(onDecide, assetId, 'left' as SwipeDirection);
        scheduleOnRN(gatedHaptic, Haptics.ImpactFeedbackStyle.Heavy);
      } else if (swipedRight) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, SPRING.flyOff);
        scheduleOnRN(onDecide, assetId, 'right' as SwipeDirection);
        scheduleOnRN(gatedHaptic, Haptics.ImpactFeedbackStyle.Medium);
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
        style={[{ width: SCREEN_WIDTH - 48, height: CARD_HEIGHT, left: 24, zIndex }, cardStyle]}
      >
        <Image
          source={{ uri }}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={isTopCard ? 0 : 200}
          recyclingKey={uri}
        />
        {isTopCard && (
          <ActionOverlay translateX={translateX} sizeLabel={sizeLabel} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}
