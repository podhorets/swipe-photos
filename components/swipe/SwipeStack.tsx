import { useCallback, useEffect, useImperativeHandle, useRef, memo } from 'react';
import type { Ref } from 'react';
import { View, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSessionStore } from '@/stores/sessionStore';
import { SwipeCard, type SwipeCardHandle, type SwipeDirection } from './SwipeCard';
import { SkeletonTile } from '@/components/ui/SkeletonTile';
import { SWIPE } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

export interface SwipeStackHandle {
  dismiss: (direction: SwipeDirection) => void;
}

interface SwipeStackProps {
  onDoubleTap: (assetId: string) => void;
  onSessionComplete: () => void;
  ref?: Ref<SwipeStackHandle>;
}

export const SwipeStack = memo(function SwipeStack({ onDoubleTap, onSessionComplete, ref }: SwipeStackProps) {
  // Select only the primitives we need — avoids full re-render on unrelated store changes
  const session = useSessionStore((s) => s.session);
  const currentIndex = useSessionStore((s) => s.currentIndex);
  // Direction of the most recent currentIndex transition. Sourced from the store
  // rather than a render-phase ref mutation so it stays deterministic under
  // StrictMode / concurrent rendering.
  const lastAction = useSessionStore((s) => s.lastAction);
  // URI snapshot captured at session-start — stable for the entire session lifetime.
  // Never rebuilds due to gallery index changes, so no O(50k) Map builds during swiping.
  const uriById = useSessionStore((s) => s.uriSnapshot);
  // sizeSnapshot and mediaTypeSnapshot are NOT selected here — each SwipeCard reads
  // its own size via narrow per-asset selectors so only that card re-renders when
  // a size arrives from the background fetch, not the entire stack.

  const totalCount = session?.assetIds.length ?? 0;
  const isComplete = totalCount > 0 && currentIndex >= totalCount;

  // After a forward swipe keep the just-swiped card mounted one slot behind so its
  // fly-off animation can finish. After undo, start the slice at currentIndex directly
  // — otherwise we'd mount a fresh SwipeCard (translateX=0) in the departing position
  // and render it on top as a ghost card.
  const isUndo = lastAction === 'undo';
  const renderSliceStart = isUndo ? currentIndex : Math.max(0, currentIndex - 1);
  const allRenderIds = session?.assetIds.slice(renderSliceStart, currentIndex + 3) ?? [];
  const visibleAssetIds = session?.assetIds.slice(currentIndex, currentIndex + 3) ?? [];

  // Prefetch the next few cards beyond the visible stack
  useEffect(() => {
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

  // Stable decide handler — reads the store via getState so we avoid stale closures
  // and don't need to re-memoize when session identity changes.
  const onDecide = useCallback((assetId: string, direction: SwipeDirection) => {
    useSessionStore.getState().decide(assetId, direction === 'left' ? 'delete' : 'keep');
  }, []);

  // Per-asset ref map so the imperative dismiss() can look up whichever card is
  // currently the top card. React clears entries automatically on unmount via the
  // null callback.
  const cardRefs = useRef<Map<string, SwipeCardHandle | null>>(new Map());

  // Stable ref-callback per assetId. In React 19 `ref` is a regular prop, so an
  // inline arrow would break SwipeCard's memo comparison on every SwipeStack render.
  // These callbacks are created once per assetId and reused for the session lifetime.
  const refCallbacks = useRef<Map<string, (h: SwipeCardHandle | null) => void>>(new Map());
  const getRefCallback = useCallback((assetId: string) => {
    if (!refCallbacks.current.has(assetId)) {
      refCallbacks.current.set(assetId, (h) => {
        if (h) cardRefs.current.set(assetId, h);
        else cardRefs.current.delete(assetId);
      });
    }
    return refCallbacks.current.get(assetId)!;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      dismiss: (direction) => {
        const state = useSessionStore.getState();
        const topId = state.session?.assetIds[state.currentIndex];
        if (!topId) return;
        const handle = cardRefs.current.get(topId);
        handle?.dismiss(direction);
      },
    }),
    [],
  );

  // Auto-skip assets that were deleted externally (no longer in gallery index)
  const topAssetId = visibleAssetIds[0];
  useEffect(() => {
    if (topAssetId && !uriById.has(topAssetId)) {
      useSessionStore.getState().decide(topAssetId, 'keep');
    }
  }, [topAssetId, uriById]);

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

        return (
          <SwipeCard
            key={assetId}
            ref={getRefCallback(assetId)}
            assetId={assetId}
            uri={uri}
            stackIndex={stackIndex}
            zIndex={zIndex}
            onDecide={onDecide}
            onDoubleTap={onDoubleTap}
          />
        );
      })}
    </View>
  );
});

const SESSION_PREFETCH = 5;
