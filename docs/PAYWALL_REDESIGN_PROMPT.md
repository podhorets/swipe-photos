# Prompt for Claude Design — Paywall Redesign

> Paste everything below the line into Claude Design. It is self-contained.

---

## Your task

Redesign the paywall screen for **Swipe Photos**, an iOS photo-cleaning app, to be a
top-notch, eye-catching, high-conversion subscription screen. Deliver both:

1. A **visual concept** (describe the composition, motion, and copy — including how the
   screen adapts per entry context; a rendered mockup/artifact is welcome), and
2. A **production implementation** in the app's real stack (React Native + Expo,
   NativeWind, Reanimated, RevenueCat) that drops into `app/paywall.tsx`.

Before designing, briefly **recommend the paywall conversion tactics** you'll apply and
why (a short list is fine) — I want your expert take, not just execution. Stay on the
right side of the line: persuasive, not dark-pattern. The close button must exist and
work; Apple reviews this screen.

## What the app does (use this for accurate, benefit-led copy)

Swipe Photos helps people reclaim phone storage by cleaning their photo library fast:

- **Swipe to clean**: Tinder-style card stack — swipe left to delete, right to keep.
  Review by year, month, "On This Day", screenshots, videos, or a random batch.
- **Clean similar photos (AI)**: on-device Apple Vision analysis groups near-duplicate
  bursts, auto-picks the sharpest "best" shot, and deletes the rest in one tap.
- **Private by design**: 100% on-device. No uploads, no accounts, no cloud.

Typical user has **thousands to tens of thousands** of photos. By the time they hit the
paywall they've already swiped through real sessions and felt the product work — the
paywall's job is to remove the wait, not to introduce the app.

## Business model & pricing (exact — the copy must match)

- **Free plan:** 2 review sessions per day, 25-photo batches. Quota refills at local
  midnight.
- **Pro:** unlimited sessions, 100-photo batches ("4× bigger sessions").
- **Plans:** Weekly at `$4.99/week` (with a **3-day free trial** when the user is
  intro-eligible) and Annual at `$29.99/year` (≈ `$0.58/week`, the "BEST VALUE ·
  SAVE 88%" default selection). Prices come from RevenueCat at runtime
  (`product.priceString`); the dollar values above are fallbacks when offerings fail to
  load (`FALLBACK_PRICING` in `constants/config.ts`).

## Entry contexts (required — the screen must adapt)

The paywall is a full-screen modal opened with a `context` route param. Each context is
a different emotional moment; the hero/headline (at minimum) must adapt:

1. **`sessions`** — the user just finished their 2nd free session of the day and tried
   to start another. Peak motivation, artificial wait. Today's screen shows a **live
   countdown to the midnight refill** ("Free sessions refill in 6:41:03") next to the
   upgrade offer. Keep or improve this tension mechanic.
2. **`batch`** — the user tried to select the locked 100-photo batch size in settings.
   Sell the bigger-session speedup specifically.
3. **`chip`** — the user tapped the sessions-remaining chip on the home screen.
   Curiosity/pre-emptive; a general "clean 10× faster" pitch.
4. **`settings`** — the user tapped "Upgrade to Pro" in settings. Deliberate,
   high-intent shopper; general pitch is fine.

The current implementation also computes a **personalized loss-framing stat** from real
gallery data: "N photos still waiting — at 50 free photos a day, that's M months of
cleaning. Pro clears it in days." (from `galleryStore` index minus `keepStore` keeps,
shown when ≥500 remain). This is the strongest single element on the screen — keep it,
make it more prominent, or evolve it into the hero.

## Conversion best-practices to apply (baseline — improve on these)

- **Anchor on annual** (pre-selected, per-week equivalent price, savings badge); weekly
  is the flexible fallback that carries the free trial.
- **Sell outcomes, not features**: freed gigabytes, a cleared backlog this week, zero
  waiting — not "unlimited sessions" in the abstract.
- **Personalized, slightly loss-framed numbers** beat generic claims. Real backlog
  counts, real countdown timers.
- **Trial transparency converts**: when the trial is available, show the day-by-day
  timeline (today unlocked → day-2 reminder → day-3 billing, cancel anytime). It reduces
  fear, and Apple likes it.
- **One unmistakable CTA**, sticky at the bottom, label reflecting the actual charge
  ("Start My 3-Day Free Trial" / "Unlock Unlimited — $29.99/year"). Auto-renewal
  disclosure directly beneath it.
- **Reassurance near the ask**: cancel anytime, private by design, no ads.
- **Motion sells on this screen too** — the onboarding was just redesigned around
  auto-playing UI-thread demos (a self-swiping card, a duplicate-collapse animation).
  The paywall today is completely static; consider a living hero that shows what Pro
  *feels* like (e.g. batches flying through, a backlog melting down, freed-space
  counting up). Add haptics on key beats.
- **No dark patterns**: close button present (a short ~1.5s fade-in delay is the
  accepted maximum), no fake urgency, no pre-checked traps, honest pricing everywhere.

## Design system — MATCH IT EXACTLY (this is a real, shipping app)

Dark, glassmorphic, aurora-lit. Do not invent a new visual language; extend this one.

**Background:** near-black `#050508`. Behind content, soft radial "aurora" glow blobs —
violet `rgba(94,92,230,0.30)` and blue `rgba(10,132,255,0.28)`. Existing component:
`AuroraBackground variant="onboarding"` (the variant the paywall uses today).

**Surfaces:** frosted glass cards — `rgba(255,255,255,0.07)` fill, `rgba(255,255,255,0.12)`
border (top border brighter `0.28`), soft shadow, ~24px radius, blur. Existing
component: `GlassCard`.

**Gradients (use for heroes, CTAs, accents):**
- accent (primary): `['#0A84FF', '#5E5CE6']`
- delete: `['#FF453A', '#FF6482']`
- keep/freed: `['#30D158', '#64D2FF']`
- star (AI/best/Pro): `['#FF9F0A', '#FFD60A']`
- analytics/violet: `['#BF5AF2', '#5E5CE6']`

**Semantic colors:** delete `#FF453A`, keep `#30D158`, accent blue `#0A84FF`, star/amber
`#FF9F0A`. Text: primary `#FFFFFF`, secondary `rgba(255,255,255,0.55)`, tertiary `0.40`.

**Type:** big extrabold titles (~32px on this screen, tight letter-spacing, 2 lines),
15–17px secondary copy at `0.55` opacity. Icons: Ionicons.

**Primary CTA:** full-width gradient pill (`GradientPillButton`, accent gradient, glow
shadow, built-in `loading`/`disabled` states).

## Tech constraints (the implementation must obey these — hard rules)

- **React Native + Expo Router.** Screen lives at `app/paywall.tsx`, presented as a
  `fullScreenModal`, opened via `router.push({ pathname: '/paywall', params: { context } })`.
- **Styling: NativeWind (`className`) only — never `StyleSheet.create`.** `style` prop is
  allowed *only* for Reanimated animated styles and computed/dynamic values.
- **Animations: `react-native-reanimated` worklets** (UI-thread). `expo-haptics` for
  haptic feedback, `expo-linear-gradient` for gradients.
- Reuse existing components: `AuroraBackground`, `GlassCard`, `GradientPillButton`, and
  theme tokens from `constants/theme.ts` (`GRADIENTS`, `COLORS`, `SPRING`).
- **Preserve the purchase plumbing exactly** (all in `lib/purchases.ts`):
  `loadOfferings()` → `offering.weekly` / `offering.annual` packages;
  `checkTrialEligibility(productId)` gates all trial UI; `purchase(pkg)` returns
  `'purchased' | 'cancelled' | 'failed'` ('cancelled' = user closed the Apple sheet —
  stay quiet, stay on the paywall); `restore()` for Restore Purchases.
- **Handle the offerings-unavailable state**: show `FALLBACK_PRICING`, disable the CTA
  once loading resolves with no packages, and alert "store not reachable" on tap. CTA
  shows a loading state until offerings resolve.
- **Preserve analytics** (`posthog.capture`): `paywall_shown` {context},
  `paywall_dismissed` {context}, `purchase_started` / `purchase_completed` /
  `purchase_failed` {package, context}, `trial_started`, `restore_completed` {restored}.
- **Apple compliance is non-negotiable:** auto-renewal disclosure under the CTA stating
  the real price and period (trial phrasing when a trial is shown), and visible
  **Restore Purchases**, **Terms** (Apple standard EULA), and **Privacy** links.
- Keep the **delayed close button** pattern: present, fades in after ~1.5s, disabled
  while a purchase is in flight, rendered above the ScrollView in the hit test.
- Success path: success haptic + `router.back()`. Keep motion smooth on mid-range
  devices — no JS-thread timers driving layout (the 1s countdown `setInterval` updating
  a Text is fine).

## Current implementation (what you're replacing)

`app/paywall.tsx` today, top to bottom: amber sparkles icon in a gradient circle →
context-aware headline → (conditional) personalized backlog glass card → three
feature checkrows → two plan cards (Yearly pre-selected with "BEST VALUE · SAVE 88%"
badge + per-week price, Weekly with trial note) → (conditional) 3-step trial timeline →
reassurance strip → sticky gradient CTA + auto-renew disclosure + Restore/Terms/Privacy
links, with a delayed-fade close button top-left. It's functionally complete and
compliant, but visually it's a static list — no motion, no living hero, and it reads
like a settings page while onboarding (just redesigned) now demos the product with
animation. That's the gap: make the paywall *feel* like the upgrade it's selling,
without breaking any of the plumbing above.

## Deliverable format

1. **Recommendations** — the conversion tactics you're applying (brief).
2. **Concept** — the hero visual and motion (what animates, when, driven by what), the
   copy system (headline/subtitle per entry context, plan cards, CTA labels, disclosure),
   layout order, and the rationale for each major decision.
3. **Implementation** — the full `app/paywall.tsx` (and any small new components under
   `components/`), NativeWind + Reanimated, matching the design system and obeying all
   tech constraints above. Runnable as-is.

Optional: a rendered visual mockup/artifact of the paywall (per-context variants
welcome) to preview the look.
