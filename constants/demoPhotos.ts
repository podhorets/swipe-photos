/**
 * Photos for the onboarding demos and the paywall hero.
 *
 * Every slot takes either form:
 *   - a bundled asset:  require('../assets/onboarding/swipe-1.jpg')
 *   - a remote link:    'https://example.com/swipe-1.jpg'
 *
 * Links must be https — iOS App Transport Security blocks plain http, and the
 * card silently keeps its gradient. expo-image disk-caches a remote image after
 * the first successful load, so the cost is paid once per install.
 *
 * Trade-off worth knowing before choosing links for onboarding: it is the first
 * screen of a cold install, which is exactly when the cache is empty and the
 * device may be offline. A link that hasn't loaded yet shows the gradient
 * placeholder, not a broken image — degraded, never ugly, but the photo you
 * chose may simply not be there on first run. The paywall is far more forgiving,
 * since it appears well into the session. Bundled assets always render.
 *
 * Any slot left `null` keeps its placeholder: a gradient in the swipe deck and
 * paywall hero, a flat dark socket in the dedup demo.
 * Recommended: portrait ~3:4, ≤1000px long edge, visually warm "keeper" shots.
 */
export type DemoPhoto = number | string | null;

export interface SwipeDemoCard {
  photo: DemoPhoto;
  /** Which way this card is swiped, and therefore which overlay it shows. */
  decision: 'delete' | 'keep';
}

/**
 * Onboarding screen 1 — the deck the demo swipes through, in order, on a loop.
 * Each card also feeds the back-of-deck slot on the beat before its own, so the
 * photos want to look like they belong to one library.
 *
 * The paywall hero reuses the first two.
 */
export const SWIPE_DEMO_CARDS: SwipeDemoCard[] = [
  { photo: require('../assets/onboarding/swipe-1.jpg'), decision: 'delete' },
  { photo: require('../assets/onboarding/swipe-2.jpg'), decision: 'keep' },
  { photo: require('../assets/onboarding/swipe-3.jpg'), decision: 'delete' },
  { photo: require('../assets/onboarding/swipe-4.jpg'), decision: 'keep' },
];

/**
 * Onboarding screen 2 — four takes of the SAME scene, so the "these are
 * near-duplicates" read lands. Index 0 opens as the main shot; the thumbnails
 * below are indices 1–3, in order.
 */
export const DEDUP_DEMO_PHOTOS: [DemoPhoto, DemoPhoto, DemoPhoto, DemoPhoto] = [
  require('../assets/onboarding/dedup-1.jpg'), // soft focus — opens as the main shot
  require('../assets/onboarding/dedup-2.jpg'), // underexposed
  require('../assets/onboarding/dedup-3.jpg'), // sharp — the pick (DEDUP_BEST_INDEX)
  require('../assets/onboarding/dedup-4.jpg'), // slight blur
];

/**
 * Which take the on-device analysis "picks". It swaps into the main slot and
 * takes the Best badge, while index 0 drops into the thumbnail it vacated —
 * the point of the animation is that the best shot is not the first one.
 * Must be a thumbnail index (1–3), never 0.
 */
export const DEDUP_BEST_INDEX: 1 | 2 | 3 = 2;
