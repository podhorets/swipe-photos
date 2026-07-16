import type { AssetMeta } from '@/types';

/**
 * Group assets by creation-time proximity. Consecutive photos taken within
 * `windowMs` of each other end up in one group; only groups with 2+ photos
 * are returned. Sorts an ascending copy internally — the gallery index is
 * newest-first, and the chaining below requires ascending order.
 */
export function groupAssetsByTime(assets: AssetMeta[], windowMs: number): AssetMeta[][] {
  const sorted = assets.slice().sort((a, b) => a.creationTime - b.creationTime);

  const groups: AssetMeta[][] = [];
  let group: AssetMeta[] = [];

  for (const current of sorted) {
    if (group.length === 0) {
      group.push(current);
      continue;
    }
    const last = group[group.length - 1];
    if (current.creationTime - last.creationTime <= windowMs) {
      group.push(current);
    } else {
      if (group.length > 1) groups.push(group);
      group = [current];
    }
  }
  if (group.length > 1) groups.push(group);

  return groups;
}
