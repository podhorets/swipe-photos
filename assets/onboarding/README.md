# Onboarding demo photos

Drop 6 photos here, then wire them up in `app/onboarding.tsx` → `DEMO_PHOTOS`
(each slot has a `TODO: require(...)` comment; any slot left `null` keeps its
gradient placeholder).

| File | Where it appears | Notes |
|---|---|---|
| `swipe-top.jpg` | Screen 1 — the card that auto-swipes left/right | Most visible asset in onboarding |
| `swipe-back.jpg` | Screen 1 — card peeking behind the top card | Dimmed to 80%, mostly covered |
| `dedup-best.jpg` | Screen 2 — the big starred "Best" kept shot | |
| `dedup-dupe-1.jpg` | Screen 2 — duplicate thumbnail 1 | Use 3 slightly-different takes |
| `dedup-dupe-2.jpg` | Screen 2 — duplicate thumbnail 2 | of the SAME scene as `dedup-best` |
| `dedup-dupe-3.jpg` | Screen 2 — duplicate thumbnail 3 | so the collapse animation reads |

Format: JPG/PNG, portrait ~3:4, ≤1000px on the long edge (cards render at
190×254 and 180×220 pt; thumbnails at 56×56 pt). These are bundled into the
app binary — keep them small.
