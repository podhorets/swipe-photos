import type { AssetMeta } from '@/types';
import { GALLERY } from '@/constants/config';
import { toMMDD, toYYYYMM } from '@/lib/dateUtils';

// ─── By Year ─────────────────────────────────────────────────────────────────

/** Returns assets grouped by year, sorted newest year first. */
export function getByYear(index: AssetMeta[]): Map<number, AssetMeta[]> {
  const map = new Map<number, AssetMeta[]>();
  for (const asset of index) {
    const year = new Date(asset.creationTime).getFullYear();
    const bucket = map.get(year) ?? [];
    bucket.push(asset);
    map.set(year, bucket);
  }
  // Sort map keys descending (newest year first)
  return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
}

// ─── By Month ────────────────────────────────────────────────────────────────

/** Returns assets grouped by "YYYY-MM", sorted newest month first. */
export function getByMonth(index: AssetMeta[]): Map<string, AssetMeta[]> {
  const map = new Map<string, AssetMeta[]>();
  for (const asset of index) {
    const key = toYYYYMM(new Date(asset.creationTime));
    const bucket = map.get(key) ?? [];
    bucket.push(asset);
    map.set(key, bucket);
  }
  return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
}

// ─── On This Day ─────────────────────────────────────────────────────────────

/**
 * Assets taken on the same calendar day (MM-DD) in past years.
 * Excludes the current year — those belong in regular review.
 * Grouped by year, sorted newest year first.
 */
export function getOnThisDayByYear(
  index: AssetMeta[],
  today: Date = new Date(),
): Map<number, AssetMeta[]> {
  const todayMMDD = toMMDD(today);
  const currentYear = today.getFullYear();
  const map = new Map<number, AssetMeta[]>();

  for (const asset of index) {
    const date = new Date(asset.creationTime);
    const year = date.getFullYear();
    if (year === currentYear) continue; // skip current year
    if (toMMDD(date) !== todayMMDD) continue;

    const bucket = map.get(year) ?? [];
    bucket.push(asset);
    map.set(year, bucket);
  }

  return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
}

/**
 * Flat list of all "On This Day" assets across all years.
 * Used for session creation when a specific year is chosen.
 */
export function getOnThisDay(
  index: AssetMeta[],
  today: Date = new Date(),
): AssetMeta[] {
  const grouped = getOnThisDayByYear(index, today);
  return Array.from(grouped.values()).flat();
}

// ─── Screenshots ─────────────────────────────────────────────────────────────

/**
 * Uses iOS native `mediaSubtypes` for accurate detection.
 * Falls back to dimension matching for any asset without subtypes.
 */
export function getScreenshots(index: AssetMeta[]): AssetMeta[] {
  return index.filter((asset) => {
    // Prefer native iOS screenshot subtype (exact)
    if (asset.mediaSubtypes.includes('screenshot')) return true;

    // Fallback: match common iPhone screen dimensions
    return GALLERY.screenshotDimensions.some(
      ({ w, h }) =>
        (asset.width === w && asset.height === h) ||
        (asset.width === h && asset.height === w), // landscape screenshots
    );
  });
}

// ─── Videos ──────────────────────────────────────────────────────────────────

/** Videos sorted by duration descending (longest = most storage impact first). */
export function getVideos(index: AssetMeta[]): AssetMeta[] {
  return index
    .filter((a) => a.mediaType === 'video')
    .sort((a, b) => b.duration - a.duration);
}

// ─── Favorites ───────────────────────────────────────────────────────────────

/** Assets whose IDs are in the iOS Favorites smart album. */
export function getFavorites(
  index: AssetMeta[],
  favoriteIds: Set<string>,
): AssetMeta[] {
  if (favoriteIds.size === 0) return [];
  return index.filter((a) => favoriteIds.has(a.id));
}

// ─── Random Review ───────────────────────────────────────────────────────────

/** Fisher-Yates shuffle, returns `count` random assets. */
export function getRandom(
  index: AssetMeta[],
  count: number = GALLERY.defaultBatchSize,
): AssetMeta[] {
  const pool = [...index];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
