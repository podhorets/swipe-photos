import * as Haptics from 'expo-haptics';
import { useSessionStore } from '@/stores/sessionStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { createSession, type SessionRequest } from '@/lib/session/sessionFactory';

export function useSession() {
  const store = useSessionStore();

  function startSession(request: SessionRequest) {
    const { index, favoriteIds } = useGalleryStore.getState();
    const session = createSession(request, index, favoriteIds);
    store.startSession(session);
    return session;
  }

  function swipeLeft(assetId: string) {
    // Stage for deletion — deletionStore wired on Day 4
    store.decide(assetId, 'delete');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function swipeRight(assetId: string) {
    store.decide(assetId, 'keep');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function swipeUp(assetId: string) {
    store.decide(assetId, 'favorite');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function undoLast() {
    const restoredId = store.undoLast();
    if (restoredId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    return restoredId;
  }

  const { session, currentIndex, decisions } = store;
  const totalCount = session?.assetIds.length ?? 0;
  const remainingCount = totalCount - currentIndex;
  const progressFraction = totalCount > 0 ? currentIndex / totalCount : 0;
  const isComplete = totalCount > 0 && remainingCount === 0;

  // Current and next few asset IDs for the swipe stack
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
