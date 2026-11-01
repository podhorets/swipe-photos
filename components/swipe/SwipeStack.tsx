import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, memo } from 'react';
import type { Ref } from 'react';
import { View, Dimensions, InteractionManager } from 'react-native';
import { Image } from 'expo-image';
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useSessionStore } from '@/stores/sessionStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { SwipeCard, type SwipeDirection } from './SwipeCard';
import { SkeletonTile } from '@/components/ui/SkeletonTile';
import { REVIEW_CARD, SPRING, SWIPE } from '@/constants/theme';
import { gatedHaptic } from '@/lib/haptics';
import { fetchAssetSize } from '@/lib/sizeUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HEIGHT = REVIEW_CARD.height;
const CARD_LEFT = (SCREEN_WIDTH - REVIEW_CARD.width) / 2;
const FLY_OFF_X = SCREEN_WIDTH * 1.5;

export interface SwipeStackHandle {
  dismiss: (direction: SwipeDirection) => void;
}

interface SwipeStackProps {
  onDoubleTap: (assetId: string) => void;
  onSessionComplete: () => void;
  ref?: Ref<SwipeStackHandle>;
}

/** Eight translation slots; the card at session position p uses slot p % SLOT_COUNT. */
function useSlots(): SharedValue<number>[] {
  const s0 = useSharedValue(0);
  const s1 = useSharedValue(0);
  const s2 = useSharedValue(0);
  const s3 = useSharedValue(0);
  const s4 = useSharedValue(0);
  const s5 = useSharedValue(0);
  const s6 = useSharedValue(0);
  const s7 = useSharedValue(0);
  return useMemo(() => [s0, s1, s2, s3, s4, s5, s6, s7], [s0, s1, s2, s3, s4, s5, s6, s7]);
}

export const SwipeStack = memo(function SwipeStack({ onDoubleTap, onSessionComplete, ref }: SwipeStackProps) {
  // Select only the primitives we need — avoids full re-render on unrelated store changes
  const session = useSessionStore((s) => s.session);
  const currentIndex = useSessionStore((s) => s.currentIndex);
  // Direction of the most recent currentIndex transition — 'undo' moves the
  // UI-thread top back, anything else can only move it forward.
  const lastAction = useSessionStore((s) => s.lastAction);
  // URI snapshot captured at session-start — stable for the entire session lifetime.
  // Never rebuilds due to gallery index changes, so no O(50k) Map builds during swiping.
  const uriById = useSessionStore((s) => s.uriSnapshot);
  // sizeSnapshot and mediaTypeSnapshot are NOT selected here — each SwipeCard reads
  // its own size via narrow per-asset selectors so only that card re-renders when
  // a size arrives from the background fetch, not the entire stack.

  const totalCount = session?.assetIds.length ?? 0;
  const isComplete = totalCount > 0 && currentIndex >= totalCount;

  // ── UI-thread swipe state ───────────────────────────────────────────────────
  // topPos is the authority on which card a touch drives. It advances inside the
  // gesture's onEnd, on the UI thread, so a swipe that starts while the previous
  // card is still flying off binds to the next card — React's re-render (which
  // updates currentIndex and the mounted window) only catches up afterwards.
  const topPos = useSharedValue(currentIndex);
  // Spring-follows topPos; cards derive their stack depth from it (promote animation)
  const animTop = useSharedValue(currentIndex);
  const totalSV = useSharedValue(totalCount);
  // Card the current touch is bound to (-1 = none)
  const activePos = useSharedValue(-1);
  const hasPassedThreshold = useSharedValue(false);
  const slotsX = useSlots();
  const slotsY = useSlots();
  const slotCount = slotsX.length;

  useEffect(() => {
    totalSV.value = totalCount;
  }, [totalCount, totalSV]);

  // New session in the same mount: start the UI side over
  useEffect(() => {
    const start = useSessionStore.getState().currentIndex;
    topPos.value = start;
    animTop.value = start;
    for (let i = 0; i < slotCount; i++) {
      slotsX[i].value = 0;
      slotsY[i].value = 0;
    }
  }, [session?.id, topPos, animTop, slotsX, slotsY, slotCount]);

  // JS → UI sync. Swipes advance topPos before the store; the store only moves
  // it on its own for undo (back) or auto-skip of externally deleted assets (forward).
  useEffect(() => {
    if (lastAction === 'undo') {
      const restored = currentIndex % slotCount;
      topPos.value = currentIndex;
      animTop.value = withSpring(currentIndex, SPRING.promote);
      slotsX[restored].value = withSpring(0, SPRING.snappy);
      slotsY[restored].value = withSpring(0, SPRING.snappy);
      // The card before it is mounted again as the departing slot — keep it
      // off-screen even if its slot was recycled since it flew.
      const prevPos = currentIndex - 1;
      const prevSlot = slotsX[prevPos % slotCount];
      if (prevPos >= 0 && Math.abs(prevSlot.value) < SCREEN_WIDTH) {
        const state = useSessionStore.getState();
        const prevId = state.session?.assetIds[prevPos];
        prevSlot.value = prevId && state.decisions[prevId] === 'delete' ? -FLY_OFF_X : FLY_OFF_X;
      }
    } else if (currentIndex > topPos.value) {
      topPos.value = currentIndex;
      animTop.value = withSpring(currentIndex, SPRING.promote);
    }
  }, [currentIndex, lastAction, topPos, animTop, slotsX, slotsY, slotCount]);

  // ── Decisions (JS) ──────────────────────────────────────────────────────────
  // scheduleOnRN preserves call order, so decisions land in swipe order even
  // when the UI is a card or two ahead of the store.
  const decideAt = useCallback((pos: number, direction: SwipeDirection) => {
    const state = useSessionStore.getState();
    const assetId = state.session?.assetIds[pos];
    if (!assetId) return;
    state.decide(assetId, direction === 'left' ? 'delete' : 'keep');
  }, []);

  const doubleTapAt = useCallback((pos: number) => {
    const assetId = useSessionStore.getState().session?.assetIds[pos];
    if (assetId) onDoubleTap(assetId);
  }, [onDoubleTap]);

  // ── Gesture (UI) ────────────────────────────────────────────────────────────
  // Unified commit path — used by the pan and by the action buttons, so both
  // behave identically and share topPos as their single source of truth.
  const commitSwipe = useCallback((pos: number, direction: SwipeDirection) => {
    'worklet';
    if (pos !== topPos.value || pos >= totalSV.value) return;
    const sign = direction === 'left' ? -1 : 1;
    // Continues from wherever the finger left the card
    slotsX[pos % slotCount].value = withSpring(sign * FLY_OFF_X, SPRING.flyOff);
    topPos.value = pos + 1;
    animTop.value = withSpring(pos + 1, SPRING.promote);
    // The card entering the hidden staging depth reuses a slot last used by a
    // card that flew off four swipes ago — reset it before it becomes visible.
    const staging = (pos + 4) % slotCount;
    slotsX[staging].value = 0;
    slotsY[staging].value = 0;
    scheduleOnRN(decideAt, pos, direction);
    scheduleOnRN(
      gatedHaptic,
      direction === 'left' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium,
    );
  }, [topPos, totalSV, animTop, slotsX, slotsY, slotCount, decideAt]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      // Bind this touch to whatever is on top right now
      activePos.value = topPos.value < totalSV.value ? topPos.value : -1;
      hasPassedThreshold.value = false;
    })
    .onUpdate((e) => {
      const pos = activePos.value;
      // A button press may have committed this card mid-drag — stop steering it
      if (pos < 0 || pos !== topPos.value) return;
      slotsX[pos % slotCount].value = e.translationX;
      slotsY[pos % slotCount].value = e.translationY;

      const crossed = Math.abs(e.translationX) > SWIPE.thresholdPx;
      if (crossed && !hasPassedThreshold.value) {
        hasPassedThreshold.value = true;
        scheduleOnRN(gatedHaptic, Haptics.ImpactFeedbackStyle.Medium);
      } else if (!crossed) {
        hasPassedThreshold.value = false;
      }
    })
    .onEnd((e) => {
      const pos = activePos.value;
      if (pos < 0 || pos !== topPos.value) return;
      const swipedLeft =
        e.translationX < -SWIPE.thresholdPx ||
        (e.translationX < -SWIPE.thresholdPx * 0.5 && e.velocityX < -SWIPE.velocityThresholdX);
      const swipedRight =
        e.translationX > SWIPE.thresholdPx ||
        (e.translationX > SWIPE.thresholdPx * 0.5 && e.velocityX > SWIPE.velocityThresholdX);
      if (swipedLeft) commitSwipe(pos, 'left');
      else if (swipedRight) commitSwipe(pos, 'right');
    })
    .onFinalize(() => {
      // Not committed (released under threshold, or cancelled) → snap back
      // with spring overshoot. A committed card no longer matches topPos.
      const pos = activePos.value;
      activePos.value = -1;
      if (pos < 0 || pos !== topPos.value) return;
      slotsX[pos % slotCount].value = withSpring(0, SPRING.snappy);
      slotsY[pos % slotCount].value = withSpring(0, SPRING.snappy);
      hasPassedThreshold.value = false;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (topPos.value < totalSV.value) scheduleOnRN(doubleTapAt, topPos.value);
    });

  // Race: pan activates immediately, doubleTap wins on second tap
  const composed = Gesture.Race(doubleTap, pan);

  useImperativeHandle(
    ref,
    () => ({
      dismiss: (direction) => {
        scheduleOnUI(() => {
          'worklet';
          commitSwipe(topPos.value, direction);
        });
      },
    }),
    [commitSwipe, topPos],
  );

  // ── Rendering (JS catches up) ───────────────────────────────────────────────
  // Mounted window: the just-departed card (kept for its fly-off), the visible
  // stack, and hidden staging cards so a JS lag of a swipe or two never leaves
  // the UI-thread top card unmounted.
  const renderStart = Math.max(0, currentIndex - 1);
  const renderEnd = currentIndex + RENDER_AHEAD;
  const renderIds = session?.assetIds.slice(renderStart, renderEnd) ?? [];
  const visibleAssetIds = session?.assetIds.slice(currentIndex, currentIndex + SWIPE.stackSize) ?? [];

  // Off-screen decode pool: render upcoming cards at exact card dimensions so
  // SDWebImage fully decodes them into memory cache before they mount as cards.
  // Image.prefetch only warms the disk cache; this forces the decode step.
  const offScreenIds = session?.assetIds
    .slice(renderEnd, renderEnd + DECODE_POOL_AHEAD)
    .filter(id => !!uriById.get(id)) ?? [];

  // Disk-prefetch cards beyond the decode pool so they warm from the Photos
  // library into SDWebImage's disk cache before they enter the decode pool.
  useEffect(() => {
    if (!session) return;
    const from = currentIndex + RENDER_AHEAD + DECODE_POOL_AHEAD;
    session.assetIds
      .slice(from, from + DISK_PREFETCH_AHEAD)
      .forEach((id) => {
        const uri = uriById.get(id);
        if (uri) Image.prefetch(uri);
      });
  }, [currentIndex, session?.id, uriById]);

  // Lazy real-size fetch for the visible window. The store already holds a
  // dimension-based estimate seeded at session-start, so the UI never shows a
  // stale flat constant — this effect just upgrades estimates to real on-disk
  // bytes as cards approach the top.
  //
  // Scheduled via InteractionManager so the bridge call to Photos.framework
  // waits for the swipe gesture/animation to settle. realFetchedRef dedupes
  // across re-renders and undo, so each asset is fetched at most once per
  // session lifetime.
  const realFetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!session) return;
    const targets = session.assetIds.slice(currentIndex, currentIndex + SIZE_FETCH_AHEAD);
    const handle = InteractionManager.runAfterInteractions(() => {
      const galleryIndex = useGalleryStore.getState().index;
      for (const id of targets) {
        if (realFetchedRef.current.has(id)) continue;
        const asset = galleryIndex.find((a) => a.id === id);
        if (!asset) continue;
        realFetchedRef.current.add(id);
        fetchAssetSize(asset).then((bytes) => {
          useSessionStore.getState().setSize(id, bytes);
        });
      }
    });
    return () => handle.cancel();
  }, [currentIndex, session?.id]);

  useEffect(() => {
    if (isComplete) onSessionComplete();
  }, [isComplete, onSessionComplete]);

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
          width={REVIEW_CARD.width}
          height={CARD_HEIGHT}
          borderRadius={32}
          style={{ position: 'absolute', left: CARD_LEFT, top: 0 }}
        />
      </View>
    );
  }

  return (
    <GestureDetector gesture={composed}>
      <View
        style={{
          width: SCREEN_WIDTH,
          height: CARD_HEIGHT + SWIPE.stackOffsetY[SWIPE.stackSize - 1],
        }}
      >
        {/* Off-screen decode pool — all images absolutely overlap at the same
            position above the viewport. Forces SDWebImage to decode each image
            at card size into memory cache before it mounts as a card. */}
        {offScreenIds.map((id) => (
          <Image
            key={`decode-${id}`}
            source={{ uri: uriById.get(id) }}
            style={{ position: 'absolute', top: -9999, left: CARD_LEFT, width: REVIEW_CARD.width, height: CARD_HEIGHT }}
            contentFit="cover"
            pointerEvents="none"
          />
        ))}

        {/* Deepest card first, departing card last: later siblings draw on top,
            so stacking order follows session position with no zIndex juggling. */}
        {renderIds
          .map((assetId, i) => ({ assetId, pos: renderStart + i }))
          .reverse()
          .map(({ assetId, pos }) => (
            <SwipeCard
              key={assetId}
              assetId={assetId}
              uri={uriById.get(assetId) ?? ''}
              pos={pos}
              tx={slotsX[pos % slotCount]}
              ty={slotsY[pos % slotCount]}
              animTop={animTop}
              isTopCard={pos === currentIndex}
            />
          ))}
      </View>
    </GestureDetector>
  );
});

// Cards mounted from currentIndex: 3 visible + 2 hidden staging cards, which
// absorb a JS lag of up to two swipes behind the UI thread.

const RENDER_AHEAD = SWIPE.stackSize + 2;
// Cards rendered off-screen at card dimensions to force SDWebImage memory-cache decode.
// Memory cost: ~750KB per card × 10 ≈ 7.5 MB — negligible on modern iPhones.
const DECODE_POOL_AHEAD = 10;
// Cards beyond the decode pool that get disk-prefetched from the Photos library.
const DISK_PREFETCH_AHEAD = 8;
// How many upcoming cards to upgrade from estimate → real on-disk size.
// Each card costs one MediaLibrary.getAssetInfoAsync bridge call.
const SIZE_FETCH_AHEAD = 6;
