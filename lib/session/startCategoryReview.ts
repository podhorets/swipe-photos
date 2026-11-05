import { Alert } from 'react-native';
import { router } from 'expo-router';
import { posthog } from '@/lib/posthog';
import { gateSessionStart } from '@/lib/sessionGate';
import type { Category } from '@/types';

/**
 * Starts a review of one stack (Screenshots, Videos, Random…), shared by Home
 * and Library. Explains instead when the stack is empty or fully reviewed.
 */
export function startCategoryReview(
  category: Category,
  { label, count, progress, indexing }: { label: string; count: number; progress?: number; indexing: boolean },
) {
  if (!indexing && count === 0) {
    Alert.alert('Nothing Here', `No photos in "${label}" yet.`);
    return;
  }
  if (progress !== undefined && progress >= 1) {
    Alert.alert('All Photos Reviewed', 'You\'ve reviewed all photos in this category.', [{ text: 'OK' }]);
    return;
  }
  if (!gateSessionStart()) return;
  posthog.capture('review_session_started', { category, photo_count: count });
  router.push(`/review/${category}`);
}
