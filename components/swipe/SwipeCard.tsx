import { memo, useEffect, useMemo } from 'react';
import { Dimensions, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { REVIEW_CARD, SWIPE } from '@/constants/theme';
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

// Stack depth → look. Depth 3 is the hidden staging slot behind the visible stack.
const DEPTHS = [0, 1, 2, 3];
const DEPTH_SCALE = [...SWIPE.stackScale, SWIPE.stackScale[SWIPE.stackSize - 1]];
const DEPTH_OFFSET_Y = [...SWIPE.stackOffsetY, SWIPE.stackOffsetY[SWIPE.stackSize - 1]];
const DEPTH_OPACITY = [...SWIPE.stackOpacity, 0];

export type SwipeDirection = 'left' | 'right';

interface SwipeCardProps {
  assetId: string;
  uri: string;
  /** Index of this card in the session. */
  pos: number;
  /** Translation slot this card reads — written by SwipeStack's gesture and fly-off. */
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  /** Spring-follows the UI-thread top position; depth = pos − animTop. */
  animTop: SharedValue<number>;
  /** JS-side top (store currentIndex). Cosmetic only — chips and video playback. */
  isTopCard: boolean;
}

/**
 * Presentational card. It owns no gesture: SwipeStack's single pan decides on the
 * UI thread which card a touch drives, so a swipe that starts while the previous
 * card is still flying off always lands on the next card.
 */
export const SwipeCard = memo(function SwipeCard({
  assetId,
  uri,
  pos,
  tx,
  ty,
  animTop,
  isTopCard,
}: SwipeCardProps) {
  // Narrow per-asset selectors — only this card re-renders when its own size
  // arrives from the background fetch, not the entire SwipeStack.
  const realSize = useSessionStore((s) => s.sizeSnapshot.get(assetId));
  const mediaType = useSessionStore((s) => s.mediaTypeSnapshot.get(assetId));
  const sizeLabel = realSize != null ? formatBytes(realSize) : '';
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

  const cardStyle = useAnimatedStyle(() => {
    // Departed cards (pos < animTop) keep the depth-0 look while they fly off
    const depth = Math.max(0, pos - animTop.value);
    const rotate = interpolate(
      tx.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-0.15, 0, 0.15],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rotate}rad` },
        { scale: interpolate(depth, DEPTHS, DEPTH_SCALE, Extrapolation.CLAMP) },
      ],
      opacity: interpolate(depth, DEPTHS, DEPTH_OPACITY, Extrapolation.CLAMP),
      top: interpolate(depth, DEPTHS, DEPTH_OFFSET_Y, Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View
      className="absolute rounded-4xl overflow-hidden border border-white/25"
      pointerEvents="none"
      style={[
        {
          width: REVIEW_CARD.width,
          height: REVIEW_CARD.height,
          left: CARD_LEFT,
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
        </>
      )}
      {/* Every card gets an overlay — whichever one is moving shows it, even
          before React knows it became the top card. */}
      <ActionOverlay translateX={tx} sizeLabel={sizeLabel} />
    </Animated.View>
  );
});
