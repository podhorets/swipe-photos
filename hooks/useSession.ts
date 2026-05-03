import {
  createSession,
  type SessionRequest,
} from "@/lib/session/sessionFactory";
import { gatedHaptic } from "@/lib/haptics";
import { fetchAssetSizesInBackground } from "@/lib/sizeUtils";
import { useGalleryStore } from "@/stores/galleryStore";
import { useKeepStore } from "@/stores/keepStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
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
    const batchSize = useSettingsStore.getState().batchSize;
    const newSession = createSession(
      { ...request, batchSize: request.batchSize ?? batchSize },
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
    for (const a of index) {
      if (sessionIdSet.has(a.id)) {
        uriSnapshot.set(a.id, a.uri);
        mediaTypeSnapshot.set(a.id, a.mediaType);
      }
    }

    startSessionAction(newSession, uriSnapshot, mediaTypeSnapshot);

    // TODO: remove it or rework, because it makes first swipes laggy (while this calculation is performed
    // Run fetch in background to avoid freezing the UI on the first card
    // fetchAssetSizesInBackground(mediaTypeSnapshot, (assetId, size) => {
    //   useSessionStore.getState().setSize(assetId, size);
    // });

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
