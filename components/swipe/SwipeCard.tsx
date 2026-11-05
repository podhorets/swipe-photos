import { memo, useEffect, useMemo } from 'react';
import { Dimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { PhotoChip } from '@/components/ui/PhotoChip';
import { ON_PHOTO } from '@/constants/colors';
import { REVIEW_CARD, SWIPE } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { formatBytes } from '@/lib/dateUtils';
import { useSessionStore } from '@/stores/sessionStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { ActionOverlay } from './ActionOverlay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_LEFT = (SCREEN_WIDTH - REVIEW_CARD.width) / 2;


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
  const theme = useTheme();
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
      className="absolute rounded-[26px] overflow-hidden bg-track"
      pointerEvents="none"
      style={[
        {
          width: REVIEW_CARD.width,
          height: REVIEW_CARD.height,
          left: CARD_LEFT,
          boxShadow: theme.shadow.swipeCard,
        },
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
            colors={ON_PHOTO.scrim}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 }}
            pointerEvents="none"
          />
          <View className="absolute left-3 bottom-3.5 flex-row gap-2" pointerEvents="none">
            {!!dateLabel && <PhotoChip label={dateLabel} icon="calendar" />}
            {!!sizeLabel && <PhotoChip label={sizeLabel} />}
          </View>
        </>
      )}
      {/* Every card gets an overlay — whichever one is moving shows it, even
          before React knows it became the top card. */}
      <ActionOverlay translateX={tx} sizeLabel={sizeLabel} />
    </Animated.View>
  );
});
