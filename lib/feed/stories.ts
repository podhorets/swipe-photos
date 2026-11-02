import type { AssetMeta } from '@/types';
import type { LocationMap } from '@/stores/placesStore';
import { nearestPlace } from '@/lib/places/nearestPlace';

export interface FeedStory {
  /** Stable across launches — used to remember which stories were opened */
  key: string;
  title: string;
  /** Newest first; a session reviews the first `batchSize` of them */
  ids: string[];
  coverUri: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// A gap this long (or a different country) ends a place story
const PLACE_GAP_MS = 12 * 60 * 60 * 1000;
// A place story is named after its city when this share of photos is there
const CITY_SHARE = 0.6;

const MONTHS = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function shortYear(ms: number): string {
  return `'${String(new Date(ms).getFullYear()).slice(2)}`;
}

function story(key: string, title: string, assets: AssetMeta[]): FeedStory {
  const sorted = [...assets].sort((a, b) => b.creationTime - a.creationTime);
  return { key, title, ids: sorted.map((a) => a.id), coverUri: sorted[0].uri };
}

/**
 * Alternates place and time stories (place, time, place, time…) so the row
 * never shows a long run of one kind. Each kind keeps its own order; once one
 * runs out, the rest of the other follows.
 */
function interleave(places: FeedStory[], times: FeedStory[]): FeedStory[] {
  const out: FeedStory[] = [];
  for (let i = 0; i < Math.max(places.length, times.length); i++) {
    if (places[i]) out.push(places[i]);
    if (times[i]) out.push(times[i]);
  }
  return out;
}

/**
 * Story groups for the feed, places and times alternating. Places run newest
 * trip first; times run Yesterday, This week, then months newest first.
 * Groups smaller than `minSize` are left out. A photo can be in more than one
 * story.
 */
export function buildFeedStories(
  index: AssetMeta[],
  locations: LocationMap,
  minSize: number,
  now = Date.now(),
): FeedStory[] {
  const times: FeedStory[] = [];
  const today = startOfDay(now);

  // ── Time ──────────────────────────────────────────────────────────────────
  const yesterday = index.filter((a) => a.creationTime >= today - DAY_MS && a.creationTime < today);
  if (yesterday.length >= minSize) times.push(story(`day:${today - DAY_MS}`, 'Yesterday', yesterday));
  const week = index.filter((a) => a.creationTime >= today - 6 * DAY_MS);
  if (week.length >= minSize) times.push(story(`week:${today}`, 'This week', week));

  // ── Places ────────────────────────────────────────────────────────────────
  const located = index
    .filter((a) => locations[a.id])
    .sort((a, b) => a.creationTime - b.creationTime)
    .map((a) => {
      const [lat, lon] = locations[a.id];
      return { asset: a, place: nearestPlace(lat, lon) };
    })
    .filter((p): p is { asset: AssetMeta; place: NonNullable<typeof p.place> } => p.place !== null);

  const trips: (typeof located)[] = [];
  for (const p of located) {
    const trip = trips[trips.length - 1];
    const last = trip?.[trip.length - 1];
    if (
      last &&
      p.asset.creationTime - last.asset.creationTime <= PLACE_GAP_MS &&
      p.place.country === last.place.country
    ) {
      trip.push(p);
    } else {
      trips.push([p]);
    }
  }

  const placeStories: FeedStory[] = [];
  const titlesUsed = new Map<string, number>();
  for (const trip of trips.reverse()) {
    if (trip.length < minSize) continue;
    const cityCounts = new Map<string, number>();
    for (const p of trip) if (p.place.city) cityCounts.set(p.place.city, (cityCounts.get(p.place.city) ?? 0) + 1);
    const [topCity, topCount] = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const name = topCity && topCount / trip.length >= CITY_SHARE ? topCity : trip[0].place.country;
    // Repeat visits get a year, e.g. "Lisbon" then "Lisbon '24"
    const seen = titlesUsed.get(name) ?? 0;
    titlesUsed.set(name, seen + 1);
    const start = trip[0].asset.creationTime;
    const title = seen === 0 ? name : `${name} ${shortYear(start)}`;
    placeStories.push(story(`place:${name}:${start}`, title, trip.map((p) => p.asset)));
  }

  // ── Months ────────────────────────────────────────────────────────────────
  const months = new Map<string, AssetMeta[]>();
  for (const a of index) {
    const d = new Date(a.creationTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.set(key, [...(months.get(key) ?? []), a]);
  }
  const monthKeys = [...months.keys()].sort().reverse();
  for (const key of monthKeys) {
    const assets = months.get(key)!;
    if (assets.length < minSize) continue;
    const [y, m] = key.split('-').map(Number);
    times.push(story(`month:${key}`, `${MONTHS[m - 1]} '${String(y).slice(2)}`, assets));
  }

  return interleave(placeStories, times);
}
