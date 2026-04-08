import { Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
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
  const baseScale = SWIPE.stackScale[stackIndex] ?? 1;
  const baseOffsetY = SWIPE.stackOffsetY[stackIndex] ?? 0;
  const baseOpacity = SWIPE.stackOpacity[stackIndex] ?? 1;

  const pan = Gesture.Pan()
    .enabled(isTopCard)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;

      const crossed = Math.abs(e.translationX) > SWIPE.thresholdPx;
      if (crossed && !hasPassedThreshold.value) {
        hasPassedThreshold.value = true;
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
      } else if (!crossed) {
        hasPassedThreshold.value = false;
      }
    })
    .onEnd((e) => {
      const swipedLeft = e.translationX < -SWIPE.thresholdPx;
      const swipedRight = e.translationX > SWIPE.thresholdPx;
      const swipedUp =
        e.translationY < -SWIPE.upThresholdPx &&
        Math.abs(e.translationX) < SWIPE.thresholdPx;

      if (swipedLeft) {
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, SPRING.flyOff, () => {
          runOnJS(onSwipeLeft)();
        });
      } else if (swipedRight) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, SPRING.flyOff, () => {
          runOnJS(onSwipeRight)();
        });
      } else if (swipedUp) {
        translateY.value = withSpring(-SCREEN_HEIGHT, SPRING.flyOff, () => {
          runOnJS(onSwipeUp)();
        });
      } else {
        translateX.value = withSpring(0, SPRING.snappy);
        translateY.value = withSpring(0, SPRING.snappy);
        hasPassedThreshold.value = false;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(isTopCard)
    .onEnd(() => {
      runOnJS(onDoubleTap)();
    });

  // Race: pan activates immediately on movement, doubleTap wins on second tap.
  // Exclusive would delay pan by ~300ms waiting for doubleTap to fail.
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
        { scale: baseScale },
      ],
      opacity: baseOpacity,
      // Use `top` not `marginTop` — marginTop has no effect on absolute elements
      top: baseOffsetY,
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        className="absolute rounded-3xl overflow-hidden"
        style={[
          {
            width: SCREEN_WIDTH - 48,
            height: CARD_HEIGHT,
            left: 24,
          },
          cardStyle,
        ]}
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
