import * as Haptics from 'expo-haptics';
import { useSessionStore } from '@/stores/sessionStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createSession, type SessionRequest } from '@/lib/session/sessionFactory';

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
    for (const a of index) {
      if (sessionIdSet.has(a.id)) {
        uriSnapshot.set(a.id, a.uri);
      }
    }

    startSessionAction(newSession, uriSnapshot);
    return newSession;
  }

  function swipeLeft(assetId: string) {
    decideAction(assetId, 'delete');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function swipeRight(assetId: string) {
    decideAction(assetId, 'keep');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function undoLast() {
    const restoredId = undoLastAction();
    if (restoredId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    return restoredId;
  }

  const totalCount = session?.assetIds.length ?? 0;
  const remainingCount = totalCount - currentIndex;
  const progressFraction = totalCount > 0 ? currentIndex / totalCount : 0;
  const isComplete = totalCount > 0 && remainingCount === 0;
  const visibleAssetIds = session?.assetIds.slice(currentIndex, currentIndex + 3) ?? [];

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
