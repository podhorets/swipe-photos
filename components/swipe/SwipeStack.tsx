import { useEffect, useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSessionStore } from '@/stores/sessionStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useDeletionStore } from '@/stores/deletionStore';
import { useReviewedStore } from '@/stores/reviewedStore';
import { SwipeCard } from './SwipeCard';
import { SkeletonTile } from '@/components/ui/SkeletonTile';
import { SWIPE } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

interface SwipeStackProps {
  onDoubleTap: (assetId: string) => void;
  onSessionComplete: () => void;
}

export function SwipeStack({ onDoubleTap, onSessionComplete }: SwipeStackProps) {
  // Select only the primitives we need — avoids full re-render on unrelated store changes
  const session = useSessionStore((s) => s.session);
  const currentIndex = useSessionStore((s) => s.currentIndex);
  const decide = useSessionStore((s) => s.decide);
  const index = useGalleryStore((s) => s.index);
  const stage = useDeletionStore((s) => s.stage);
  const record = useReviewedStore((s) => s.record);

  const totalCount = session?.assetIds.length ?? 0;
  const isComplete = totalCount > 0 && currentIndex >= totalCount;
  // Include one card behind currentIndex so the just-swiped card stays mounted during its fly-off
  const renderSliceStart = Math.max(0, currentIndex - 1);
  const allRenderIds = session?.assetIds.slice(renderSliceStart, currentIndex + 3) ?? [];
  const visibleAssetIds = session?.assetIds.slice(currentIndex, currentIndex + 3) ?? [];

  // Build uri lookup once — only rebuilds when gallery index changes, NOT on every swipe
  const uriById = useMemo(
    () => new Map(index.map((a) => [a.id, a.uri])),
    [index],
  );

  // Prefetch the next few cards beyond the visible stack
  useMemo(() => {
    if (!session) return;
    const prefetchSlice = session.assetIds.slice(
      currentIndex + SWIPE.stackSize,
      currentIndex + SWIPE.stackSize + SESSION_PREFETCH,
    );
    prefetchSlice.forEach((id) => {
      const uri = uriById.get(id);
      if (uri) Image.prefetch(uri);
    });
  }, [currentIndex, session?.id, uriById]);

  useEffect(() => {
    if (isComplete) onSessionComplete();
  }, [isComplete, onSessionComplete]);

  // Auto-skip assets that were deleted externally (no longer in gallery index)
  const topAssetId = visibleAssetIds[0];
  useEffect(() => {
    if (topAssetId && !uriById.has(topAssetId)) {
      decide(topAssetId, 'keep');
    }
  }, [topAssetId, uriById, decide]);

  // Session complete — nothing to render (sheet is shown by parent)
  if (isComplete) return null;

  // Session started but assets not yet resolved — show skeleton placeholder
  if (visibleAssetIds.length === 0) {
    return (
      <View style={{ width: SCREEN_WIDTH, height: CARD_HEIGHT + SWIPE.stackOffsetY[SWIPE.stackSize - 1] }}>
        <SkeletonTile
          width={SCREEN_WIDTH - 48}
          height={CARD_HEIGHT}
          borderRadius={24}
          style={{ position: 'absolute', left: 24, top: 0 }}
        />
      </View>
    );
  }

  // Render back-to-front so top card (stackIndex 0) is visually on top.
  // Departing card (index < currentIndex) is rendered first = behind everything.
  const renderIds = [...allRenderIds].reverse();

  return (
    <View
      style={{
        width: SCREEN_WIDTH,
        height: CARD_HEIGHT + SWIPE.stackOffsetY[SWIPE.stackSize - 1],
      }}
    >
      {renderIds.map((assetId) => {
        const positionInVisible = visibleAssetIds.indexOf(assetId);
        // -1 means this card is the just-departed one — keep mounted for fly-off, not interactive
        const stackIndex = positionInVisible === -1 ? -1 : positionInVisible;
        const uri = uriById.get(assetId) ?? '';

        return (
          <SwipeCard
            key={assetId}
            uri={uri}
            stackIndex={stackIndex}
            onSwipeLeft={() => {
              decide(assetId, 'delete');
              stage(assetId);
              record(assetId, 'delete');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }}
            onSwipeRight={() => {
              decide(assetId, 'keep');
              record(assetId, 'keep');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            onSwipeUp={() => {
              decide(assetId, 'favorite');
              record(assetId, 'favorite');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            onDoubleTap={() => onDoubleTap(assetId)}
          />
        );
      })}
    </View>
  );
}

const SESSION_PREFETCH = 5;
