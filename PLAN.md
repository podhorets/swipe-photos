# Swipe Photos — Production Launch Plan

Step-by-step plan to get from current state → first paid iOS subscribers.

**Legend:**
- 👤 = You do this (signup / dashboard / App Store Connect / device testing)
- 🤖 = Code change (can be done in edit mode)
- ✅ = Verification step

**Stack:** RevenueCat (subs) + Sentry (crashes) + PostHog (analytics + flags) + expo-store-review (ratings).
**Scope:** iOS only for v1. Android deferred.

---

## Phase 0 — Decisions ✅

- [x] 👤 **Free vs Paid gate:** Free = 1 review session per day. Paid = unlimited sessions, On This Day, By Month, trash recovery, future features.
- [x] 👤 **Pricing:** Weekly $4.99 with 3-day free trial · Annual $49.99 (no trial)
- [x] 👤 **Paywall trigger:** After onboarding completes AND on second session start of the day
- [ ] 👤 **Privacy Policy + Terms URLs** — deferred, do before Phase 5 submission

---

## Phase 1 — Telemetry First ✅

### 1.1 Sentry — DONE
- [x] Account created, DSN configured, auth token added as EAS secret
- [x] `@sentry/react-native` installed, plugin configured with org/project in `app.json`
- [x] `Sentry.init()` + `Sentry.wrap(RootLayout)` in `_layout.tsx`
- [x] `EXPO_PUBLIC_SENTRY_DSN` in `eas.json` and `.env`
- [x] ✅ Tested and working

### 1.2 PostHog — DONE
- [x] Account created, key in `.env` as `EXPO_PUBLIC_POSTHOG_KEY`
- [x] `posthog-react-native` installed, singleton in `lib/posthog.ts`
- [x] `PostHogProvider` + screen tracking + analytics opt-in sync in `_layout.tsx`
- [x] Events instrumented: `onboarding_completed`, `review_session_started`, `review_session_completed`, `review_session_abandoned`, `month_review_started`, `photos_deleted`, `setting_changed`
- [x] Pre-built dashboards live in PostHog project
- [x] ✅ Tested and working
- [ ] ✅ Add `paywall_shown`, `paywall_dismissed`, `paywall_purchased`, `purchase_restored` — deferred to Phase 3 (paywall screen)

---

## Phase 2 — App Store Connect Foundation

This is paperwork-heavy and slow on Apple's side. Start now in parallel with code.

### 2.1 Account & Agreements
- [ ] 👤 Apple Developer account active ($99/yr) — confirm at https://developer.apple.com/account
- [ ] 👤 App Store Connect → Agreements, Tax, and Banking → sign **Paid Apps Agreement**
- [ ] 👤 Complete tax forms (US W-9 or W-8BEN if non-US)
- [ ] 👤 Complete banking forms — payouts will not work without this
- [ ] ✅ Status of Paid Apps Agreement shows "Active" (not "Pending")

### 2.2 App Record
- [ ] 👤 App Store Connect → My Apps → "+" → New App
- [ ] 👤 Bundle ID: `com.podhorets.swipephotos` (already set in `app.json`)
- [ ] 👤 SKU: `swipephotos-ios` (any unique string)
- [ ] 👤 Primary language: English
- [ ] 👤 Set up app metadata: name, subtitle, description, keywords, support URL, marketing URL
- [ ] 👤 Privacy Policy URL — required (host the page first; see Phase 0)
- [ ] 👤 Age rating questionnaire — answer all, likely 4+

### 2.3 Subscription Products
- [ ] 👤 In App Store Connect → your app → In-App Purchases → Subscriptions
- [ ] 👤 Create a **Subscription Group** named e.g. `swipe_photos_pro`
- [ ] 👤 Add product: Reference name `Pro Weekly`, Product ID `pro_weekly_499`, weekly duration, price tier matching $4.99
- [ ] 👤 Add product: Reference name `Pro Annual`, Product ID `pro_annual_2999`, yearly duration, price tier matching $29.99
- [ ] 👤 For weekly: set up **Introductory Offer** → 3-day free trial, eligible for new subscribers
- [ ] 👤 Add localized display name + description for each product (shown in paywall)
- [ ] 👤 Add a Review Note explaining how reviewers can test (e.g. "Tap any session start; paywall will appear")
- [ ] 👤 **Upload a paywall screenshot** (Apple requires this for each subscription)
- [ ] 👤 Each product status should be "Ready to Submit" (will be auto-submitted with first app submission)

### 2.4 Privacy Nutrition Labels
- [ ] 👤 App Store Connect → app → App Privacy → Get Started
- [ ] 👤 Declare data collected:
  - **Sentry:** Crash Data, Performance Data, Other Diagnostic Data — *not* linked to user
  - **PostHog:** Product Interaction, Other Usage Data — *not* linked to user (using anonymous IDs)
  - **RevenueCat:** Purchase History — *linked* to user (subscription state)
- [ ] 👤 Photos: declare you access photo library but **do not collect or transmit** images. Critical for trust.

### 2.5 TestFlight
- [ ] 👤 App Store Connect → TestFlight → enable internal testing
- [ ] 👤 Add 1-2 internal testers (yourself + a friend)
- [ ] 👤 Later: external testing with ~5-10 users (Apple review takes ~24h)

---

## Phase 3 — RevenueCat & Subscriptions

### 3.1 RevenueCat Dashboard Setup
- [ ] 👤 Create account at https://www.revenuecat.com (free up to $2.5k MTR)
- [ ] 👤 Create new project → "Swipe Photos"
- [ ] 👤 Add iOS app → Bundle ID `com.podhorets.swipephotos`
- [ ] 👤 Upload **App Store Connect API Key**:
  - In ASC: Users and Access → Integrations → App Store Connect API → generate key with **Admin** access
  - Download `.p8` file (one-time only — save it)
  - Note: Issuer ID, Key ID
  - Upload all three to RevenueCat
- [ ] 👤 Upload **In-App Purchase shared secret** from ASC → app → App Information → App-Specific Shared Secret
- [ ] 👤 In RevenueCat → Products → import products from App Store (should pull `pro_weekly_499` and `pro_annual_2999`)
- [ ] 👤 In RevenueCat → Entitlements → create entitlement called `pro` → attach both products to it
- [ ] 👤 In RevenueCat → Offerings → create default offering `default` → add both products as packages (`$rc_weekly`, `$rc_annual`)
- [ ] 👤 Copy the **iOS API key** (starts with `appl_`) from Project Settings → API keys

### 3.2 SDK Integration
- [ ] 🤖 `npx expo install react-native-purchases react-native-purchases-ui`
- [ ] 🤖 Add RevenueCat config plugin to `app.json`
- [ ] 🤖 Create `lib/purchases.ts`:
  - Configures Purchases with iOS API key on app start
  - Exports `useEntitlement()` hook returning `{ isPro, isLoading, refresh }`
  - Exports `presentPaywall()` and `restorePurchases()`
- [ ] 🤖 Initialize in `app/_layout.tsx` after Sentry + PostHog
- [ ] 🤖 Add `EXPO_PUBLIC_REVENUECAT_IOS_KEY` to `eas.json` env
- [ ] 🤖 Wire RevenueCat customer ID to PostHog: on entitlement change, `posthog.identify(customerInfo.originalAppUserId)` so subscription state shows in analytics

### 3.3 Paywall Screen
- [ ] 🤖 Create `app/paywall.tsx` using `<RevenueCatUI.Paywall offering={...} />` — easiest path
- [ ] 🤖 Wire dismiss handler → router back
- [ ] 🤖 Wire purchase success → `posthog.capture('paywall_purchased', {...})` → router back
- [ ] 🤖 Add **Restore Purchases** button somewhere reachable (Settings screen). Apple requires this.
- [ ] 🤖 Add **Terms** + **Privacy Policy** links visible in paywall (required for auto-renewable subs)

### 3.4 Gate Logic
- [ ] 🤖 Create `hooks/usePaywall.ts`:
  - Reads `isPro` from `useEntitlement`
  - Reads daily session count from MMKV (key like `daily_sessions_${YYYY-MM-DD}`)
  - Returns `shouldGate(): boolean` based on Phase 0 decision
- [ ] 🤖 In session start flow (likely `app/(tabs)/index.tsx` or wherever sessions kick off), check gate → router.push('/paywall') if blocked
- [ ] 🤖 Show "Upgrade" affordance in Settings when not Pro

### 3.5 Verification
- [ ] 👤 Add a sandbox Apple ID: ASC → Users and Access → Sandbox → Testers → create one with a fake email
- [ ] 👤 On test device: Settings → App Store → sandbox account → sign in with sandbox tester
- [ ] ✅ Fresh install on device → trigger paywall → buy weekly with sandbox → confirm `isPro` flips to true
- [ ] ✅ Kill app, relaunch → confirm `isPro` still true
- [ ] ✅ Delete app, reinstall → tap "Restore Purchases" → confirm entitlement restored
- [ ] ✅ In RevenueCat dashboard → Customers → confirm test purchase appears
- [ ] ✅ Test annual purchase too
- [ ] ✅ In ASC sandbox, cancel the subscription → wait for renewal → confirm entitlement expires correctly

---

## Phase 4 — Polish

- [ ] 🤖 `npx expo install expo-store-review`
- [ ] 🤖 After 3rd successful session completion, call `StoreReview.requestReview()` (only once per ~120 days, iOS handles throttling)
- [ ] 👤 Generate proper 1024x1024 app icon (avoid transparency on iOS) — current state TBD
- [ ] 👤 Polish splash screen
- [ ] 👤 Take 5+ App Store screenshots on 6.9" iPhone (iPhone 16 Pro Max simulator works). Show: onboarding, swipe in action, by-month grid, paywall, settings.
- [ ] 👤 Optional: 15-30s app preview video (one of Apple's converting elements)

---

## Phase 5 — Submission

- [ ] 🤖 `eas build --profile production --platform ios`
- [ ] 🤖 `eas submit --platform ios --latest`
- [ ] 👤 In ASC: select the build, fill out "What's New", attach metadata, attach subscription products to this submission
- [ ] 👤 Submit for review
- [ ] ✅ Apple review typically <24h. Watch for rejection reasons (most common: missing restore button, missing terms link in paywall, unclear sub terms)
- [ ] 👤 Once approved → release manually (recommended) so you can verify before going live

---

## Phase 6 — Post-Launch (First Week)

- [ ] 👤 Watch Sentry for crash spikes
- [ ] 👤 Watch PostHog funnel: install → onboarding_completed → paywall_shown → paywall_purchased
- [ ] 👤 If conversion <2%, A/B test paywall variants via RevenueCat experiments
- [ ] 👤 Reply to App Store reviews (improves ranking)

---

## Reference: Credentials You Need to Collect

Save these somewhere safe (1Password / similar):

| Credential | Source | Used in |
|---|---|---|
| Sentry DSN | sentry.io project settings | `EXPO_PUBLIC_SENTRY_DSN` in `eas.json` |
| Sentry Auth Token | sentry.io account settings | `SENTRY_AUTH_TOKEN` as EAS secret |
| PostHog API Key | posthog.com project settings | `EXPO_PUBLIC_POSTHOG_KEY` in `eas.json` |
| PostHog Host | posthog.com (us or eu) | `EXPO_PUBLIC_POSTHOG_HOST` in `eas.json` |
| RevenueCat iOS API Key | revenuecat.com project | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in `eas.json` |
| ASC API `.p8` + Issuer ID + Key ID | App Store Connect | Uploaded to RevenueCat dashboard only |
| App-Specific Shared Secret | App Store Connect | Uploaded to RevenueCat dashboard only |

---

## What This Plan Deliberately Skips

- **Android** — adds days for a market that may not validate; ship iOS first.
- **Backend / auth** — app is offline-first. RevenueCat anonymous IDs handle subscription identity.
- **Attribution SDKs** (AppsFlyer/Adjust/Branch) — only matters with paid ad spend.
- **Custom paywall design** — RevenueCat's prebuilt UI converts fine for v1; iterate later.
- **Engagement push notifications** — `expo-notifications` already installed; campaign design is a v2 problem.
- **App Tracking Transparency** — not needed unless you add attribution SDKs.
