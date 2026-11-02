# Swipe Photos — Redesign brief (for Claude Design)

Design **3 complete, clearly different redesign prototypes** of the Swipe Photos iPhone app.
Only the design changes — what the home screen is, which tabs exist and what each holds,
colors, background, type, icons, components and motion. **Every feature listed below stays.**

---

## 1. The product

**Swipe Photos** (App Store name: *Swipe Photos: Photo Cleaner*) is an iPhone app for cleaning up a
photo library. You review photos one at a time — swipe right to keep, left to delete — or review
look-alike shots in groups. Nothing is deleted by accident: deletions go to an in-app Trash you
review first, then iOS confirms, then photos sit in Recently Deleted for 30 days.

- **Audience:** everyday iPhone owners with thousands of photos and a "storage full" problem;
  not photographers. Sessions are short (2–5 minutes), often daily.
- **Promise:** calm, quick, private ("your photos never leave your iPhone"), and oddly satisfying.
- **Business:** free plan = 2 reviews a day of up to 25 photos; **Swipe Photos Pro**
  (weekly $4.99 with a 3-day free trial, or yearly $29.99) = unlimited reviews, up to 100 photos each.
- **Platform:** iOS 26, iPhone only (portrait), dark mode today. Built in React Native / Expo.

## 2. Everything the app does (all must stay)

1. **Swipe review** — a card stack; swipe right = keep, left = delete; buttons too; undo; progress
   ("18 of 25 left"); double-tap opens a full-screen preview; date and size chips on the card.
2. **Review sources ("stacks")** — Random 25, On This Day, Screenshots, Videos, any month, and Feed stories.
3. **Months** — every month of the library with its progress (reviewed %).
4. **On This Day** — photos taken on today's date in past years.
5. **Similar photos** — look-alike shots grouped on the device; the sharpest is starred as best.
   Group review: a large photo + a row of thumbnails; tap to star the ones to keep (any number, or
   none); two buttons: **Keep All** and **Delete N** (deletes everything not starred).
6. **Feed** (newest feature) — an Instagram-like feed of the whole library, shuffled:
   - **stories row** on top: named groups — places (Lisbon, Tokyo, Portugal), Yesterday, This week,
     months (March '24); tapping one starts a swipe session; finished stories disappear, started ones
     show "N left";
   - **posts**: header (place or month), photo edge to edge, Similar groups as swipeable carousels;
     actions **♡ Keep**, **👎 Delete**, **bookmark** (= iOS Favorites);
   - Keep lifts the post away; Delete flies the photo into the **Trash icon with a counter**.
7. **Trash** — grid of photos marked for deletion, all selected; tap to un-select; "About 6.1 MB ·
   recoverable for 30 days"; Delete (then the iOS confirmation).
8. **Session complete** — "All done!" with kept / deleted / day streak, confetti.
9. **Stats & motivation** — items count, GB on device, % reviewed, space freed, day streak, week dots.
10. **Free-plan meter** — "1 free review left · refills at midnight · Go unlimited".
11. **Paywall** — plan cards (yearly / weekly with trial), benefits, Continue, full subscription
    terms, Restore Purchases, Terms of Use, Privacy Policy.
12. **Settings** — Pro, Restore, review size (25 / 50 / 100), Face ID lock for deleting, share
    analytics, On This Day reminder, Help, Privacy, Terms, version.
13. **Onboarding** — 3 intro screens, then the iOS photo-permission prompt (button must say "Continue").
14. **Empty / permission states** — no photos yet, limited photo access banner, photo access denied.

## 3. Today's app (screenshots on the canvas)

- **Tabs (6):** Library (home) · Months · Memories (On This Day) · Similar · Feed · Settings.
- **Home (Library):** big title, free-plan meter, storage/stats card with streak dots, a "Similar
  photos" card, then a 2×2 grid of stacks (On This Day, Screenshots, Videos, Random 25).
- **Look:** near-black background (#050508) with blurry blue/violet "aurora" glows, frosted-glass
  cards with thin light borders, iOS blue accent (#0A84FF), green keep (#30D158), red delete
  (#FF453A), white bold SF Pro headings, Ionicons, floating pill tab bar.
- **Problems to solve:** too many tabs (6) and overlapping entry points (On This Day is a tab, a
  home tile and a stack); the home screen is a dashboard with no single obvious next action; the
  look is generic "dark glass"; Feed (the strongest, most distinctive idea) is hidden as tab 5;
  stats are dense; the swipe screen is plain.

## 4. What to deliver

**Three prototypes, A / B / C, each a different product idea — not three colorways.** Each one
decides for itself:

- **Information architecture:** what the home screen is, how many tabs (aim for 3–5), what each tab
  holds, where Trash, stats, streak and Settings live, how Feed / stories / Similar / months fit.
- **Visual system:** background, color palette (with keep / delete colors), typography (iOS-safe or
  Google Fonts), icon style, card/surface style, tab bar style, and one signature element that makes
  it recognisable.
- **Motion intent** in one line (e.g. how a swipe, keep and delete feel).

**Screens per prototype (5), iPhone 390×844 artboards:**

1. **Home** (whatever that prototype decides home is)
2. **One other main tab** (e.g. browse / collections / feed — the prototype's choice)
3. **Swipe review** (mid-swipe or with the keep/delete affordances visible)
4. **Similar group review** (stars, Keep All / Delete N)
5. **Trash** *or* **Paywall** (pick whichever shows the prototype's style best)

Plus one small **style card** per prototype: palette swatches, type samples, icon samples, a button
and a card. Lay each prototype out as one row, titled "A — <name>", "B — <name>", "C — <name>",
above or next to the current-app screenshots so they can be compared.

## 5. Direction space (spread the three across it)

Make the three genuinely different along these axes — don't put all three in the middle:

- **Light ↔ dark** (at least one light-first prototype).
- **Calm utility ↔ playful/game-like** (streaks, levels, satisfying feedback).
- **Grid/library-first ↔ feed/story-first ↔ one-big-action home** ("today's stack").
- **Quiet native iOS ↔ bold editorial / branded.**

## 6. Constraints

- **Keep every feature** in section 2; you may move, merge or rename where they live.
- **iOS conventions:** 44 pt minimum tap targets, safe areas, a bottom tab bar (or a clear reason
  not to), Dynamic-Type-friendly sizes, text contrast ≥ 4.5:1, keep/delete distinguishable by more
  than red/green (icon + label + position).
- **Buildable in React Native/Expo:** blur, gradients, Skia drawing, Lottie, springs are fine; avoid
  effects that need custom native rendering.
- **App Store rules:** don't imitate Instagram, X or Apple Photos branding (no their logos, icons or
  exact gradients); paywall must show the billed price most prominently, trial terms, Restore, Terms
  and Privacy; the pre-permission button says "Continue".
- **Privacy is a selling point:** keep a visible, honest "on-device" message somewhere.
- **No fake data that misleads:** use realistic sample values — 521 items, ~543 MB, 40 similar
  groups · 81 MB to free, 27.9 MB freed, 1-day streak, stories: Prague, Nov '25, Rome, May '24,
  Portugal, Tokyo, Kyiv, Yesterday; photo content: travel, city, nature, food, people from behind.
- **Name:** "Swipe Photos" (no new name or logo needed; a simple wordmark treatment is fine).

## 7. Avoid

Generic dark-glass-with-aurora (that's today), purple-gradient AI look, emoji as UI icons,
three prototypes that differ only in color, dashboards full of numbers, copying another app's
signature look.
