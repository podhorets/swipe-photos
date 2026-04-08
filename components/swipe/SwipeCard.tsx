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
  // Stack depth: 0 = top card (interactive), 1 and 2 = background cards
  stackIndex: number;
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

  // Stack depth visual offsets (for cards 1 and 2 behind the top)
  const baseScale = SWIPE.stackScale[stackIndex];
  const baseOffsetY = SWIPE.stackOffsetY[stackIndex];
  const baseOpacity = SWIPE.stackOpacity[stackIndex];

  const pan = Gesture.Pan()
    .enabled(isTopCard)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;

      // Fire haptic once when crossing the horizontal threshold
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
      const swipedUp = e.translationY < -SWIPE.upThresholdPx && Math.abs(e.translationX) < SWIPE.thresholdPx;

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
        // Snap back
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

  const composed = Gesture.Exclusive(doubleTap, pan);

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
      // Background cards are offset downward
      marginTop: baseOffsetY,
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
        {/* Photo */}
        <Image
          source={{ uri }}
          className="flex-1"
          contentFit="cover"
          transition={200}
          recyclingKey={uri}
        />

        {/* Decision overlays — only visible on top card */}
        {isTopCard && (
          <ActionOverlay translateX={translateX} translateY={translateY} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}
