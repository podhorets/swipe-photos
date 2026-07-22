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
  { photo: "https://pbs.twimg.com/media/HAASP6qaQAAX6Bo.jpg", decision: 'delete' },
  { photo: "https://pbs.twimg.com/media/FX3ivwyXoAE_HSU.jpg", decision: 'keep' },
  { photo: "https://pbs.twimg.com/media/HNxMio6W4AAhsT9.jpg", decision: 'delete' },
  { photo: "https://pbs.twimg.com/media/HA5RBcJXAAAJOib.jpg", decision: 'keep' },
];

/**
 * Onboarding screen 2 — four takes of the SAME scene, so the "these are
 * near-duplicates" read lands. Index 0 opens as the main shot; the thumbnails
 * below are indices 1–3, in order.
 */
export const DEDUP_DEMO_PHOTOS: [DemoPhoto, DemoPhoto, DemoPhoto, DemoPhoto] = [
  "https://pbs.twimg.com/media/HFkTc7tXkAAbhtN.jpg",
  "https://pbs.twimg.com/media/Fmm6MSxXwAEFmXi.jpg",
  "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/1a74f6a4-a9a2-4c0f-8785-e69049d623f3/dggrz98-886825b4-2539-4f11-b4ce-93fb99e4ba0e.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi8xYTc0ZjZhNC1hOWEyLTRjMGYtODc4NS1lNjkwNDlkNjIzZjMvZGdncno5OC04ODY4MjViNC0yNTM5LTRmMTEtYjRjZS05M2ZiOTllNGJhMGUuanBnIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.U-pg-5a9loDHRyJh4zKbZz4yO-UH2vOGX8RMNAR2deA",
  "https://w.wallhaven.cc/full/e7/wallhaven-e7kvg8.jpg"
];

/**
 * Which take the on-device analysis "picks". It swaps into the main slot and
 * takes the Best badge, while index 0 drops into the thumbnail it vacated —
 * the point of the animation is that the best shot is not the first one.
 * Must be a thumbnail index (1–3), never 0.
 */
export const DEDUP_BEST_INDEX: 1 | 2 | 3 = 2;
