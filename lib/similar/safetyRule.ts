import type { SwipeDecision } from '@/types';

/**
 * A similar-photos group must never be fully deleted. If every member is
 * marked delete, flip the best shot (or the last member) back to keep.
 * The review UI makes this unreachable (the best is always kept); this is
 * the defensive backstop, mirroring cleani's applySimilarPhotosSafetyRule.
 */
export function enforceKeepBest(
  groupIds: string[],
  decisions: Record<string, SwipeDecision>,
  bestIds: Set<string>,
): Record<string, SwipeDecision> {
  const allDeleted = groupIds.every((id) => decisions[id] === 'delete');
  if (!allDeleted || groupIds.length === 0) return decisions;

  const keepId = groupIds.find((id) => bestIds.has(id)) ?? groupIds[groupIds.length - 1];
  return { ...decisions, [keepId]: 'keep' };
}
