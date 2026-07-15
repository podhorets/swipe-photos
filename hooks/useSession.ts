import {
  createSession,
  type SessionRequest,
} from "@/lib/session/sessionFactory";
import { gatedHaptic } from "@/lib/haptics";
import { estimateSizeFromAsset } from "@/lib/sizeUtils";
import { useGalleryStore } from "@/stores/galleryStore";
import { useKeepStore } from "@/stores/keepStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePlanStore } from "@/stores/planStore";
import { effectiveBatchSize } from "@/lib/planUtils";
import * as Haptics from "expo-haptics";

export function useSession() {
  const session = useSessionStore((s) => s.session);
  const currentIndex = useSessionStore((s) => s.currentIndex);
  const startSessionAction = useSessionStore((s) => s.startSession);
  const decideAction = useSessionStore((s) => s.decide);
  const undoLastAction = useSessionStore((s) => s.undoLast);

  function startSession(request: SessionRequest) {
    const { index } = useGalleryStore.getState();
    const keepIds = useKeepStore.getState().keepIds;
    // Free plan clamps to FREE_PLAN.maxBatchSize; the stored setting is untouched
    const batchSize = effectiveBatchSize(
      usePlanStore.getState(),
      request.batchSize ?? useSettingsStore.getState().batchSize,
    );
    const newSession = createSession(
      { ...request, batchSize },
      index,
      keepIds,
    );

    // Snapshot URIs for exactly the session's assets at creation time.
    // SwipeStack and ReviewScreen read from this snapshot for the entire
    // session lifetime — never from the live galleryStore index — so that
    // buildIndex() completing or MediaLibrary delta events mid-session cannot
    // trigger spurious re-renders or auto-skips during swiping.
    const sessionIdSet = new Set(newSession.assetIds);
    const uriSnapshot = new Map<string, string>();
    const mediaTypeSnapshot = new Map<string, string>();
    // Seed sizes synchronously from dimensions already in the index — zero I/O.
    // Real on-disk sizes are filled in lazily as cards become visible (see SwipeStack).
    const sizeSnapshot = new Map<string, number>();
    for (const a of index) {
      if (sessionIdSet.has(a.id)) {
        uriSnapshot.set(a.id, a.uri);
        mediaTypeSnapshot.set(a.id, a.mediaType);
        sizeSnapshot.set(a.id, estimateSizeFromAsset(a));
      }
    }

    startSessionAction(newSession, uriSnapshot, mediaTypeSnapshot, sizeSnapshot);

    return newSession;
  }

  function swipeLeft(assetId: string) {
    decideAction(assetId, "delete");
    gatedHaptic(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function swipeRight(assetId: string) {
    decideAction(assetId, "keep");
    gatedHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }

  function undoLast() {
    const restoredId = undoLastAction();
    if (restoredId) {
      gatedHaptic(Haptics.ImpactFeedbackStyle.Light);
    }
    return restoredId;
  }

  const totalCount = session?.assetIds.length ?? 0;
  const remainingCount = totalCount - currentIndex;
  const progressFraction = totalCount > 0 ? currentIndex / totalCount : 0;
  const isComplete = totalCount > 0 && remainingCount === 0;
  const visibleAssetIds =
    session?.assetIds.slice(currentIndex, currentIndex + 3) ?? [];

  return {
    session,
    currentIndex,
    totalCount,
    remainingCount,
    progressFraction,
    isComplete,
    visibleAssetIds,
    startSession,
    swipeLeft,
    swipeRight,
    undoLast,
  };
}
