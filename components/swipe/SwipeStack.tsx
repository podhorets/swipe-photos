import { useEffect, useMemo, useRef, memo } from 'react';
import { View, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSessionStore } from '@/stores/sessionStore';
import { SwipeCard } from './SwipeCard';
import { SkeletonTile } from '@/components/ui/SkeletonTile';
import { SWIPE } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { getEstimatedSize } from '@/lib/sizeUtils';
import { formatBytes } from '@/lib/dateUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

interface SwipeStackProps {
  onDoubleTap: (assetId: string) => void;
  onSessionComplete: () => void;
}

export const SwipeStack = memo(function SwipeStack({ onDoubleTap, onSessionComplete }: SwipeStackProps) {
  // Select only the primitives we need — avoids full re-render on unrelated store changes
  const session = useSessionStore((s) => s.session);
  const currentIndex = useSessionStore((s) => s.currentIndex);
  const decide = useSessionStore((s) => s.decide);
  // URI snapshot captured at session-start — stable for the entire session lifetime.
  // Never rebuilds due to gallery index changes, so no O(50k) Map builds during swiping.
  const uriById = useSessionStore((s) => s.uriSnapshot);
  const sizeSnapshot = useSessionStore((s) => s.sizeSnapshot);
  const mediaTypeSnapshot = useSessionStore((s) => s.mediaTypeSnapshot);

  const totalCount = session?.assetIds.length ?? 0;
  const isComplete = totalCount > 0 && currentIndex >= totalCount;

  // Track direction of currentIndex change: undo moves it backward, swipe moves it forward.
  // After undo we must NOT include the slot before currentIndex — that would mount a fresh
  // SwipeCard (translateX=0) in the departing position, rendering it on top as a ghost card.
  const prevIndexRef = useRef(currentIndex);
  const isUndo = currentIndex < prevIndexRef.current;
  prevIndexRef.current = currentIndex;

  // After a forward swipe keep the just-swiped card mounted one slot behind so its
  // fly-off animation can finish. After undo, start the slice at currentIndex directly.
  const renderSliceStart = isUndo ? currentIndex : Math.max(0, currentIndex - 1);
  const allRenderIds = session?.assetIds.slice(renderSliceStart, currentIndex + 3) ?? [];
  const visibleAssetIds = session?.assetIds.slice(currentIndex, currentIndex + 3) ?? [];

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

  return (
    <View
      style={{
        width: SCREEN_WIDTH,
        height: CARD_HEIGHT + SWIPE.stackOffsetY[SWIPE.stackSize - 1],
      }}
    >
      {/* Render front-to-back — top card first — so the native layer creates it first.
          zIndex handles visual stacking order, eliminating the brief flash of back
          cards during initial mount when the top card hasn't been created yet. */}
      {allRenderIds.map((assetId) => {
        const positionInVisible = visibleAssetIds.indexOf(assetId);
        // -1 means this card is the just-departed one — keep mounted for fly-off, not interactive
        const stackIndex = positionInVisible === -1 ? -1 : positionInVisible;
        // Departing card stays above everything during its fly-off animation;
        // visible cards are ordered top-to-bottom by decreasing zIndex.
        const zIndex = stackIndex === -1 ? 10 : (3 - stackIndex);
        const uri = uriById.get(assetId) ?? '';

        const realSize = sizeSnapshot.get(assetId);
        const estimatedSize = getEstimatedSize(mediaTypeSnapshot.get(assetId) ?? 'photo');
        const sizeLabel = `~${formatBytes(realSize ?? estimatedSize)}`;

        return (
          <SwipeCard
            key={assetId}
            uri={uri}
            sizeLabel={sizeLabel}
            stackIndex={stackIndex}
            zIndex={zIndex}
            onSwipeLeft={() => {
              decide(assetId, 'delete');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }}
            onSwipeRight={() => {
              decide(assetId, 'keep');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            onDoubleTap={() => onDoubleTap(assetId)}
          />
        );
      })}
    </View>
  );
});

const SESSION_PREFETCH = 5;
