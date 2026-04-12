import * as Haptics from 'expo-haptics';
import { useSessionStore } from '@/stores/sessionStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useDeletionStore } from '@/stores/deletionStore';
import { useReviewedStore } from '@/stores/reviewedStore';
import { createSession, type SessionRequest } from '@/lib/session/sessionFactory';

export function useSession() {
  const store = useSessionStore();
  const { stage, unstage } = useDeletionStore();

  function startSession(request: SessionRequest) {
    const { index, favoriteIds } = useGalleryStore.getState();
    const session = createSession(request, index, favoriteIds);
    store.startSession(session);
    return session;
  }

  function swipeLeft(assetId: string) {
    store.decide(assetId, 'delete');
    stage(assetId); // persist to MMKV-backed deletion queue
    useReviewedStore.getState().record(assetId, 'delete');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function swipeRight(assetId: string) {
    store.decide(assetId, 'keep');
    useReviewedStore.getState().record(assetId, 'keep');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function swipeUp(assetId: string) {
    store.decide(assetId, 'favorite');
    useReviewedStore.getState().record(assetId, 'favorite');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function undoLast() {
    const restoredId = store.undoLast();
    if (restoredId) {
      // If the undone decision was 'delete', remove from staging
      const previousDecision = store.decisions[restoredId];
      if (previousDecision === 'delete') unstage(restoredId);
      useReviewedStore.getState().remove(restoredId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    return restoredId;
  }

  const { session, currentIndex, decisions } = store;
  const totalCount = session?.assetIds.length ?? 0;
  const remainingCount = totalCount - currentIndex;
  const progressFraction = totalCount > 0 ? currentIndex / totalCount : 0;
  const isComplete = totalCount > 0 && remainingCount === 0;
  const visibleAssetIds = session?.assetIds.slice(currentIndex, currentIndex + 3) ?? [];

  return {
    session,
    currentIndex,
    decisions,
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
