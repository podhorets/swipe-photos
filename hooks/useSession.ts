import * as Haptics from 'expo-haptics';
import { useSessionStore } from '@/stores/sessionStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useDeletionStore } from '@/stores/deletionStore';
import { useReviewedStore } from '@/stores/reviewedStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createSession, type SessionRequest } from '@/lib/session/sessionFactory';

export function useSession() {
  const session = useSessionStore((s) => s.session);
  const currentIndex = useSessionStore((s) => s.currentIndex);
  const startSessionAction = useSessionStore((s) => s.startSession);
  const decideAction = useSessionStore((s) => s.decide);
  const undoLastAction = useSessionStore((s) => s.undoLast);
  const { stage, unstage } = useDeletionStore();

  function startSession(request: SessionRequest) {
    const { index, favoriteIds } = useGalleryStore.getState();
    const reviewedIds = new Set(useReviewedStore.getState().decisions.keys());
    const batchSize = useSettingsStore.getState().batchSize;
    const newSession = createSession(
      { ...request, batchSize: request.batchSize ?? batchSize },
      index,
      favoriteIds,
      reviewedIds,
    );
    startSessionAction(newSession);
    return newSession;
  }

  function swipeLeft(assetId: string) {
    decideAction(assetId, 'delete');
    stage(assetId); // persist to MMKV-backed deletion queue
    useReviewedStore.getState().record(assetId, 'delete');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function swipeRight(assetId: string) {
    decideAction(assetId, 'keep');
    useReviewedStore.getState().record(assetId, 'keep');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function swipeUp(assetId: string) {
    decideAction(assetId, 'favorite');
    useReviewedStore.getState().record(assetId, 'favorite');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function undoLast() {
    const restoredId = undoLastAction();
    if (restoredId) {
      // If the undone decision was 'delete', remove from staging
      const previousDecision = useSessionStore.getState().decisions[restoredId];
      if (previousDecision === 'delete') unstage(restoredId);
      useReviewedStore.getState().remove(restoredId);
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
    swipeUp,
    undoLast,
  };
}
