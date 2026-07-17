import { memo, useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import type { Ref } from 'react';
import { Dimensions, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { VideoView, useVideoPlayer } from 'expo-video';
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
import { REVIEW_CARD, SPRING, SWIPE } from '@/constants/theme';
import { gatedHaptic } from '@/lib/haptics';
import { formatBytes } from '@/lib/dateUtils';
import { useSessionStore } from '@/stores/sessionStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { ActionOverlay } from './ActionOverlay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_LEFT = (SCREEN_WIDTH - REVIEW_CARD.width) / 2;

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.55,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 20 },
};

const CHIP_SCRIM = ['transparent', 'rgba(0,0,0,0.55)'] as const;

export type SwipeDirection = 'left' | 'right';

export interface SwipeCardHandle {
  dismiss: (direction: SwipeDirection) => void;
}

interface SwipeCardProps {
  assetId: string;
  uri: string;
  onDecide: (assetId: string, direction: SwipeDirection) => void;
  onDoubleTap: (assetId: string) => void;
  stackIndex: number; // 0 = top (interactive), 1/2 = background, -1 = departing
  zIndex: number;     // explicit native layer order — top card always highest
  ref?: Ref<SwipeCardHandle>;
}

export const SwipeCard = memo(function SwipeCard({
  assetId,
  uri,
  onDecide,
  onDoubleTap,
  stackIndex,
  zIndex,
  ref,
}: SwipeCardProps) {
  // Narrow per-asset selectors — only this card re-renders when its own size
  // arrives from the background fetch, not the entire SwipeStack.
  const realSize = useSessionStore((s) => s.sizeSnapshot.get(assetId));
  const mediaType = useSessionStore((s) => s.mediaTypeSnapshot.get(assetId));
  const sizeLabel = realSize != null ? formatBytes(realSize) : '';
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const hasPassedThreshold = useSharedValue(false);

  const isTopCard = stackIndex === 0;
  const isDeparting = stackIndex === -1;
  const isVideo = mediaType === 'video';

  // Metadata chip date — one-time non-reactive lookup, computed only once the
  // card reaches the top. getState() keeps the "no gallery subscription during
  // an active session" invariant intact.
  const dateLabel = useMemo(() => {
    if (!isTopCard) return '';
    const asset = useGalleryStore.getState().index.find((a) => a.id === assetId);
    if (!asset?.creationTime) return '';
    return new Date(asset.creationTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [assetId, isTopCard]);

  const videoPlayer = useVideoPlayer(isVideo ? uri : null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!isVideo) return;
    if (isTopCard) videoPlayer.play();
    else videoPlayer.pause();
  }, [isTopCard, isVideo, videoPlayer]);

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
      scheduleOnRN(onDoubleTap, assetId);
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
        className="absolute rounded-4xl overflow-hidden border border-white/25"
        pointerEvents={isDeparting ? 'none' : 'auto'}
        style={[
          {
            width: REVIEW_CARD.width,
            height: REVIEW_CARD.height,
            left: CARD_LEFT,
            zIndex,
            backgroundColor: '#1C1C1E',
          },
          CARD_SHADOW,
          cardStyle,
        ]}
      >
        {isVideo ? (
          <VideoView
            player={videoPlayer}
            style={{ flex: 1 }}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri }}
            style={{ flex: 1 }}
            contentFit="cover"
            transition={0}
            recyclingKey={uri}
          />
        )}
        {isTopCard && (
          <>
            {/* Bottom scrim + metadata chips */}
            <LinearGradient
              colors={CHIP_SCRIM}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 }}
              pointerEvents="none"
            />
            <View className="absolute left-3.5 bottom-3.5 flex-row gap-2" pointerEvents="none">
              {!!dateLabel && (
                <View className="flex-row items-center gap-[5px] px-[11px] py-1.5 rounded-full bg-scrim">
                  <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.7)" />
                  <Text className="text-white text-xs font-semibold">{dateLabel}</Text>
                </View>
              )}
              {!!sizeLabel && (
                <View className="px-[11px] py-1.5 rounded-full bg-scrim">
                  <Text className="text-white text-xs font-semibold">{sizeLabel}</Text>
                </View>
              )}
            </View>
            <ActionOverlay translateX={translateX} sizeLabel={sizeLabel} />
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
});
