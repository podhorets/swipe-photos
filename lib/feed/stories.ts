import type { AssetMeta } from '@/types';
import type { LocationMap } from '@/stores/placesStore';
import { nearestPlace } from '@/lib/places/nearestPlace';
import { shuffle } from '@/lib/feed/shuffle';

export interface FeedStory {
  key: string;
  title: string;
  /** Photos still to review, newest first; a session takes the first `batchSize` */
  ids: string[];
  /** All the group's photos, reviewed or not */
  total: number;
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

/**
 * A story from a group's photos, keeping only those not reviewed yet. Null
 * when fewer than `minSize` are left — a finished story leaves the row.
 * Groups are formed from all photos first, so reviewing part of a trip never
 * splits it into two stories.
 */
function story(
  key: string,
  title: string,
  assets: AssetMeta[],
  reviewed: Set<string>,
  minSize: number,
): FeedStory | null {
  const left = assets
    .filter((a) => !reviewed.has(a.id))
    .sort((a, b) => b.creationTime - a.creationTime);
  if (left.length < minSize) return null;
  return { key, title, ids: left.map((a) => a.id), total: assets.length, coverUri: left[0].uri };
}

/**
 * Alternates place and time stories (place, time, place, time…) so the row
 * never shows a long run of one kind. Once one kind runs out, the rest of the
 * other follows.
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
 * Story groups for the feed: places and times alternating, each kind in a
 * random order (seeded, so it holds until the feed is refreshed). Each story
 * holds only photos not in `reviewed`; groups with fewer than `minSize` left
 * are dropped. A photo can be in more than one story.
 */
export function buildFeedStories(
  index: AssetMeta[],
  locations: LocationMap,
  minSize: number,
  reviewed: Set<string>,
  seed: number,
  now = Date.now(),
): FeedStory[] {
  const times: FeedStory[] = [];
  const add = (list: FeedStory[], s: FeedStory | null) => {
    if (s) list.push(s);
  };
  const today = startOfDay(now);

  // ── Time ──────────────────────────────────────────────────────────────────
  const yesterday = index.filter((a) => a.creationTime >= today - DAY_MS && a.creationTime < today);
  add(times, story(`day:${today - DAY_MS}`, 'Yesterday', yesterday, reviewed, minSize));
  const week = index.filter((a) => a.creationTime >= today - 6 * DAY_MS);
  add(times, story(`week:${today}`, 'This week', week, reviewed, minSize));

  const placeStories = buildPlaceStories(index, locations, minSize, reviewed);

  // ── Months ────────────────────────────────────────────────────────────────
  const months = new Map<string, AssetMeta[]>();
  for (const a of index) {
    const d = new Date(a.creationTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.set(key, [...(months.get(key) ?? []), a]);
  }
  const monthKeys = [...months.keys()].sort().reverse();
  for (const key of monthKeys) {
    const [y, m] = key.split('-').map(Number);
    add(times, story(`month:${key}`, `${MONTHS[m - 1]} '${String(y).slice(2)}`, months.get(key)!, reviewed, minSize));
  }

  return interleave(shuffle(placeStories, seed), shuffle(times, seed + 1));
}

/**
 * Place stories, newest trip first: GPS photos in a row with gaps of at most
 * 12 hours in one country, named after the main city or the country. Same
 * reviewed / minSize rules as buildFeedStories.
 */
export function buildPlaceStories(
  index: AssetMeta[],
  locations: LocationMap,
  minSize: number,
  reviewed: Set<string>,
): FeedStory[] {
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
  const add = (s: FeedStory | null) => {
    if (s) placeStories.push(s);
  };
  const titlesUsed = new Map<string, number>();
  for (const trip of trips.reverse()) {
    const cityCounts = new Map<string, number>();
    for (const p of trip) if (p.place.city) cityCounts.set(p.place.city, (cityCounts.get(p.place.city) ?? 0) + 1);
    const [topCity, topCount] = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const name = topCity && topCount / trip.length >= CITY_SHARE ? topCity : trip[0].place.country;
    // Repeat visits get a year, e.g. "Lisbon" then "Lisbon '24"
    const seen = titlesUsed.get(name) ?? 0;
    titlesUsed.set(name, seen + 1);
    const start = trip[0].asset.creationTime;
    const title = seen === 0 ? name : `${name} ${shortYear(start)}`;
    add(story(`place:${name}:${start}`, title, trip.map((p) => p.asset), reviewed, minSize));
  }
  return placeStories;
}
