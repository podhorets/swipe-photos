# Prompt for Claude Design — Free Sessions Indicator Redesign

> Paste everything below the line into Claude Design. It is self-contained.

---

## Your task

Redesign the **free-plan sessions indicator** on the Home screen of **Swipe Photos**,
an iOS photo-cleaning app. Today it's a tiny header pill ("⚡ 2 left"). Turn it into a
**highly visible block with a progress indicator** that shows how much of today's free
quota is used/left, carries unmissable copy, and acts as a persistent, tasteful upsell
surface (tapping it opens the paywall). Deliver both:

1. A **visual concept** (composition, motion, placement, all three states; a rendered
   mockup/artifact is welcome), and
2. A **production implementation** in the app's real stack (React Native + Expo,
   NativeWind, Reanimated) that replaces `components/ui/SessionsChip.tsx` (rename the
   component if a chip is no longer what it is) and its mount point on the Home screen.

Before designing, briefly **recommend the tactics** you'll apply (visibility vs. nag
balance, progress framing, urgency mechanics) — I want your expert take, not just
execution.

## Context: the app and the free plan

Swipe Photos cleans photo libraries via Tinder-style swipe review sessions and AI
duplicate cleanup. Business model:

- **Free plan:** 2 review sessions per day, 25-photo batches. The quota refills at
  **local midnight**. A session is only counted when **completed** (not when started).
- **Pro:** unlimited sessions, 100-photo batches. Sold via a paywall screen.

The typical free user hits the 2-session wall while motivated — this indicator is the
always-visible reminder of the limit and the highest-frequency entry point to the
paywall. It must inform first, sell second, and never feel like a punishment banner.

## Required behavior (hard requirements)

Three states, driven by sessions remaining today:

1. **2 remaining** — progress indicator at the "full/fresh" position, with clearly
   visible text: **"2 FREE reviews left"**.
2. **1 remaining** — progress advances, text: **"1 FREE review left"**.
3. **0 remaining** — progress at the "spent" position, and a **live ticking countdown**
   to the midnight refill: **"hh:mm:ss left to start new FREE review"** (e.g.
   "6:41:03 left to start new FREE review").

Plus:

- **Tap anywhere on the block → paywall** (`router.push({ pathname: '/paywall',
  params: { context: 'chip' } })`).
- **Pro users see nothing** — the component renders `null` (already the case today).
- The word **"FREE" must pop** (the user-facing term is "review"; the codebase calls
  them "sessions" — keep code naming, change only the copy).
- Progress semantics are your call, but propose one and justify it. Options:
  fraction of today's free reviews remaining (100% → 50% → 0%), or, in the exhausted
  state, progress could invert to show **time elapsed toward the refill** so the bar
  visibly refills overnight. Pick what communicates fastest at a glance.

## Design considerations (baseline — improve on these)

- **Visibility without nagging.** This lives on the Home screen permanently for free
  users. States 1–2 should read as a neutral "fuel gauge"; state 3 is where urgency
  (countdown, warmer color, subtle motion) earns its keep.
- **Color as state**: consider accent blue while reviews remain, shifting toward
  amber/warm when exhausted — the palette below has both.
- **Progress should be glanceable** — a bar, ring, or segmented (2-notch) meter; with
  only 2 units a segmented meter is honest and reads instantly.
- **Motion**: animate the progress change when a session is consumed (the user returns
  to Home right after finishing one — that's the moment to land the "1 left" beat),
  and keep the countdown ticking calm, not alarming. UI-thread animations only.
- **Upsell affordance**: a quiet hint that tapping does something (chevron, "Go
  unlimited" microcopy) without turning the gauge into an ad.
- Consider **placement**: today it's a small pill in the header row next to the streak
  chip. A more prominent block may deserve its own full-width slot under the header
  (above the storage card) — recommend where it should live; the streak chip must
  remain visible either way.

## Design system — MATCH IT EXACTLY (this is a real, shipping app)

Dark, glassmorphic, aurora-lit. Do not invent a new visual language; extend this one.

**Background:** near-black `#050508` with soft radial aurora glows behind content
(existing `AuroraBackground` component renders these).

**Surfaces:** frosted glass cards — `rgba(255,255,255,0.07)` fill,
`rgba(255,255,255,0.12)` border (top border brighter `0.28`), soft shadow, ~24px
radius. Existing component: `GlassCard`. The current chip style for reference:
`bg-[rgba(10,132,255,0.15)]` with `border-[rgba(10,132,255,0.3)]`.

**Gradients:**
- accent (primary): `['#0A84FF', '#5E5CE6']`
- delete: `['#FF453A', '#FF6482']`
- keep/freed: `['#30D158', '#64D2FF']`
- star/amber (urgency, streaks): `['#FF9F0A', '#FFD60A']`
- analytics/violet: `['#BF5AF2', '#5E5CE6']`

**Semantic colors:** accent blue `#0A84FF`, amber `#FF9F0A`, keep green `#30D158`,
delete red `#FF453A`. Text: primary `#FFFFFF`, secondary `rgba(255,255,255,0.55)`,
tertiary `0.40`. Icons: Ionicons.

**Type:** extrabold for numbers/emphasis, 13–15px UI copy, uppercase micro-labels with
wide letter-spacing where it helps hierarchy.

## Tech constraints (the implementation must obey these — hard rules)

- **Styling: NativeWind (`className`) only — never `StyleSheet.create`.** `style` prop
  allowed *only* for Reanimated animated styles and computed/dynamic values.
- **Animations: `react-native-reanimated` worklets** (UI-thread). Spring/timing configs
  come from `constants/theme.ts` (`SPRING`) — never hardcoded inline.
- **Preserve the data plumbing exactly** (see current implementation below):
  - State from `usePlanStore`: `plan`, `sessionsUsedToday`, `quotaDate`, `mockPro` —
    individual selectors only (derived objects in selectors cause re-render loops).
  - Derivations from `lib/planUtils`: `isPro(state)`, `sessionsRemaining(state, now)`,
    `msUntilMidnight(now)`, `formatCountdown(ms)` (returns `"h:mm:ss"`).
  - The 1-second `setInterval` tick must run **only while exhausted** (that's what
    drives the countdown; don't tick when reviews remain).
- Mounted on the Home screen `app/(tabs)/index.tsx` — currently inside the header row
  next to `StreakChip`. If you move it to its own slot, keep the header row working
  with `StreakChip` alone.
- Free-quota constants live in `constants/config.ts` → `FREE_PLAN.sessionsPerDay` (2).
  Don't hardcode "2" — derive the segment count/percentage from it.
- Accessibility: keep meaningful `accessibilityRole`/`accessibilityLabel` for all
  three states.

## Current implementation (what you're replacing)

`components/ui/SessionsChip.tsx`: a small `Pressable` pill in the Home header —
⚡ + "2 left" / "1 left" while reviews remain, ⏳ + a bare `h:mm:ss` countdown when
exhausted. Accent-blue tint in all states, no progress indication, no mention of
"FREE", no hint of what tapping does, and its size makes it easy to miss entirely.
That's the gap: it's the most important free-tier surface in the app and it whispers.

## Deliverable format

1. **Recommendations** — the tactics you're applying (brief).
2. **Concept** — placement decision, the progress mechanic (and its exhausted-state
   behavior), all three states rendered/described with exact copy, the state-change
   motion, and rationale.
3. **Implementation** — the replacement component (and the updated mount point in
   `app/(tabs)/index.tsx`), NativeWind + Reanimated, matching the design system and
   obeying all tech constraints above. Runnable as-is.

Optional: a rendered visual mockup/artifact of the three states to preview the look.
