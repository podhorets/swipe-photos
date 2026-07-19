# Prompt for Claude Design — Onboarding Redesign

> Paste everything below the line into Claude Design. It is self-contained.

---

## Your task

Redesign the 3-screen onboarding flow for **Swipe Photos**, an iOS photo-cleaning app,
to be a top-notch, eye-catching, high-conversion first-run experience. Deliver both:

1. A **visual concept** (describe the composition, motion, and copy for each screen; a
   rendered mockup/artifact is welcome), and
2. A **production implementation** in the app's real stack (React Native + Expo,
   NativeWind, Reanimated) that drops into `app/onboarding.tsx`.

Before designing, briefly **recommend the onboarding conversion tactics** you'll apply
and why (a short list is fine) — I want your expert take, not just execution.

## What the app does (use this for accurate, benefit-led copy)

Swipe Photos helps people reclaim phone storage by cleaning their photo library fast:

- **Swipe to clean**: Tinder-style card stack — swipe left to delete, right to keep.
  Review by year, month, "On This Day", screenshots, videos, or a random batch.
- **Clean similar photos (AI)**: on-device Apple Vision analysis groups near-duplicate
  bursts, auto-picks the sharpest "best" shot (faces + sharpness), and lets the user
  keep the best and delete the rest in one tap. Star one best or multiple.
- **Private by design**: 100% on-device. No uploads, no accounts, no cloud. (Strong
  trust asset — use it.)
- Business model: free tier (2 review sessions/day, 25-photo batches) + Pro subscription
  (unlimited, 100-photo batches) via a paywall that appears *after* onboarding.

Typical user has **thousands to tens of thousands** of photos and lots of duplicates —
lean into concrete, slightly loss-framed numbers ("Your 20,000 photos are hiding
gigabytes of duplicates").

## The 3 screens (required structure)

1. **Screen 1 — Swipe demonstration.** Make the core swipe mechanic instantly
   understood and *felt*. Show a photo card with left=delete (red) / right=keep (green)
   affordances. Strongly prefer an **animated, auto-playing demo** (a card gently
   swiping away, decision labels flashing) over static text. This is the "aha" — get
   it across in 2 seconds.
2. **Screen 2 — Cleaning similar photos.** Show the AI duplicate-cleanup superpower: a
   group of near-identical shots collapsing down to one starred "best", the rest
   sweeping into a trash/freed-space state. Emphasize "AI finds them for you" and the
   freed space payoff.
3. **Screen 3 — your call.** Design the highest-converting closing screen you can for
   THIS app, and justify it. My recommendation to react to (adopt, improve, or replace):
   a **permission-priming + trust + social-proof** screen that leads directly into the
   iOS photo-access request — frame the scary permission with value ("We scan your
   library on-device to find what's safe to delete") + the privacy promise + a proof
   point (rating/user count), so the hard ask lands at peak intent. Alternatives worth
   considering: a personalized "let's scan your library" value screen, or a light
   1-question segmentation. Pick what maximizes conversion and say why.

## Conversion best-practices to apply (baseline — improve on these)

- **Value before permission.** Never fire the iOS photo-permission dialog on screen 1.
  Demonstrate value across the flow and prime the ask on the last screen.
- **One idea per screen**, benefit-led copy (outcomes, not mechanics), "you" language.
- **Interactive/animated > static.** Motion that demonstrates the mechanic converts far
  better than an icon + paragraph. Add haptics on key beats.
- **Concrete, personalized, slightly loss-framed numbers** wherever possible.
- **Finite progress** (the flow already has step dots) + a single unmistakable CTA per
  screen; make "Skip" available but visually quiet.
- **Trust signals** (on-device/private) and **social proof** (stars, "N million cleaned")
  near the permission ask.
- **Fast to value** — 3 screens max, no dead text screens.
- **Momentum** — the final CTA text should reflect the action ("Allow Photo Access"),
  and the flow hands off into the app (and its paywall) while intent is high.

## Design system — MATCH IT EXACTLY (this is a real, shipping app)

Dark, glassmorphic, aurora-lit. Do not invent a new visual language; extend this one.

**Background:** near-black `#050508`. Behind content, soft radial "aurora" glow blobs —
violet `rgba(94,92,230,0.30)` and blue `rgba(10,132,255,0.28)` (onboarding variant uses
the stronger pair). Existing component: `AuroraBackground variant="onboarding"`.

**Surfaces:** frosted glass cards — `rgba(255,255,255,0.07)` fill, `rgba(255,255,255,0.12)`
border (top border brighter `0.28`), soft shadow, ~24px radius, blur. Existing
component: `GlassCard`.

**Gradients (use for heroes, CTAs, accents):**
- accent (primary): `['#0A84FF', '#5E5CE6']`
- delete: `['#FF453A', '#FF6482']`
- keep/freed: `['#30D158', '#64D2FF']`
- star (AI/best): `['#FF9F0A', '#FFD60A']`
- analytics/violet: `['#BF5AF2', '#5E5CE6']`

**Semantic colors:** delete `#FF453A`, keep `#30D158`, accent blue `#0A84FF`, star/amber
`#FF9F0A`. Text: primary `#FFFFFF`, secondary `rgba(255,255,255,0.55)`, tertiary `0.40`.

**Type:** big extrabold titles (~40px, tight `-1` letter-spacing, 2 lines), 17px
secondary subtitles at `0.55` opacity. Icons: Ionicons.

**Primary CTA:** full-width gradient pill (`GradientPillButton`, accent gradient, glow
shadow). Step indicator: gradient "pill" for the active dot, dim dots for the rest.

## Tech constraints (the implementation must obey these — hard rules)

- **React Native + Expo Router.** Screen lives at `app/onboarding.tsx`.
- **Styling: NativeWind (`className`) only — never `StyleSheet.create`.** `style` prop is
  allowed *only* for Reanimated animated styles and computed/dynamic values.
- **Animations: `react-native-reanimated` worklets** (UI-thread). Use `expo-haptics` for
  haptic feedback. Use `expo-linear-gradient` for gradients, `expo-image` for any images.
- Reuse existing components: `AuroraBackground`, `GlassCard`, `GradientPillButton`, and
  theme tokens from `constants/theme.ts` (`GRADIENTS`, `COLORS`, `SPRING`, `AURORA`).
- **No real photos are available during onboarding** (it runs before photo permission is
  granted). All demo imagery must be gradient/placeholder cards in the aurora palette —
  see the existing `FannedStack` for the pattern.
- Preserve the existing plumbing: horizontal slide between steps, `posthog.capture`
  analytics events (`onboarding_completed`, `onboarding_skipped` — add per-step view
  events), the `requestMedia()` / `requestNotifications()` permission calls on finish,
  and setting `STORAGE_KEYS.hasCompletedOnboarding`.
- Keep motion smooth on mid-range devices — animations run on the UI thread, no
  JS-thread timers driving layout.

## Current implementation (what you're replacing)

`app/onboarding.tsx` today: 3 horizontally-sliding steps. Step 1 = a static "fanned"
gradient-card stack with keep/delete badges + "Reclaim your phone storage". Step 2 = a
glass icon + "Swipe to decide" + three feature rows. Step 3 = lock icon + "Private by
design". Bottom: gradient step-dots, a `GradientPillButton` ("Continue" → "Allow Photo
Access"), and a quiet "Skip for now" on the last step. It's functional but static and
text-heavy — the swipe and AI-dedup mechanics are *told, not shown*. That's the gap:
make screens 1 and 2 living demonstrations.

## Deliverable format

1. **Recommendations** — the conversion tactics you're applying (brief).
2. **Per-screen concept** — for each of the 3 screens: the hero visual, the motion
   (what animates, when, driven by what), the copy (title + subtitle + any CTA), and the
   rationale. Include your screen-3 decision and why.
3. **Implementation** — the full `app/onboarding.tsx` (and any small new components under
   `components/`), NativeWind + Reanimated, matching the design system and obeying all
   tech constraints above. Runnable as-is.

Optional: a rendered visual mockup/artifact of the three screens to preview the look.
