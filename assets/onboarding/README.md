# Onboarding & paywall demo photos

The demo photos live in `constants/demoPhotos.ts`. Every slot takes either a
bundled asset or a remote link:

```ts
{ photo: require('../assets/onboarding/swipe-1.jpg'), decision: 'delete' }  // bundled
{ photo: 'https://example.com/swipe-1.jpg', decision: 'delete' }            // link
```

Any slot left `null` keeps its gradient placeholder, so a half-filled deck still
looks intentional. Links must be **https** — iOS App Transport Security blocks
plain http and the card silently falls back to its gradient.

## `SWIPE_DEMO_CARDS` — onboarding screen 1 (and the paywall hero)

Four cards the demo swipes through on a loop, in array order. Each carries the
decision it demonstrates, which picks the direction it flies and the overlay it
shows on the way out:

| # | Decision | Shown as |
|---|---|---|
| 1 | `delete` | front card, then the back card on beat 4 |
| 2 | `keep` | front card on beat 2, back card on beat 1 |
| 3 | `delete` | front card on beat 3, back card on beat 2 |
| 4 | `keep` | front card on beat 4, back card on beat 3 |

Every card is also the back-of-deck card on the beat before its own, so the four
photos should look like they came from one library. The paywall hero reuses
cards 1 and 2 as its front and back card.

Reordering, or changing a `decision`, needs no code change — the loop reads the
array. More or fewer than four cards works too.

## `DEDUP_DEMO_PHOTOS` — onboarding screen 2

Four takes of the **same scene**, so the "these are near-duplicates" read lands.
Index 0 opens in the main slot; indices 1–3 are the thumbnails below, in order.
Then `DEDUP_BEST_INDEX` (default `2`, i.e. the middle thumbnail) trades places
with index 0: after a brief pulse it flies up to the main slot and takes the
Best badge while index 0 flies down into the thumbnail it vacated. Point
`DEDUP_BEST_INDEX` at 1 or 3 and the animation follows. Unlike the swipe deck,
empty dedup slots show a flat dark socket rather than a gradient — both while a
photo is in flight and for any slot left `null`.

## Format

JPG/PNG, portrait ~3:4, ≤1000px on the long edge. Cards render at 190×254 pt
(onboarding) and 110×134 pt (paywall); the main dedup shot at 180×220 pt and its
thumbnails at 56×56 pt.

## Bundled or link?

Bundled files ship inside the binary and always render — keep them small.

Links skip the app-size cost and can be swapped without a release, but
onboarding is the first screen of a cold install: the cache is empty and the
device may be offline, so the photo may simply not appear on first run. The
gradient shows instead — degraded, never broken. expo-image disk-caches after
the first successful load, and the paywall (seen well into a session) is much
more forgiving. If you bundle only one, make it `SWIPE_DEMO_CARDS[0]`.

Drop bundled files in this folder; delete it if you go all-in on links.
