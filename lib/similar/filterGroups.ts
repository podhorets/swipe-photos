/**
 * Filter raw scan groups down to what a review session (and the Similar tab
 * summary) should show: drop kept photos, drop photos no longer in the
 * gallery index, drop groups reduced below 2 members. Used by BOTH the tab
 * and the session factory so displayed counts always match session content.
 */
export function filterGroupsForReview(
  groups: string[][],
  keepIds: Set<string>,
  indexIds: Set<string>,
): string[][] {
  const filtered: string[][] = [];
  for (const group of groups) {
    const members = group.filter((id) => !keepIds.has(id) && indexIds.has(id));
    if (members.length >= 2) filtered.push(members);
  }
  return filtered;
}
