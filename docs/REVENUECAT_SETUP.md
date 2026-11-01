# RevenueCat Subscription Setup — Step-by-Step Guide

Everything in the **code** is already done. This guide covers the accounts/console work
needed to make real purchases flow, and how to test at each stage.

## What the app already expects (do not change these without updating code)

| Thing | Value | Where it's used in code |
|---|---|---|
| Entitlement ID | `pro` | `constants/config.ts` → `PRO.entitlementId` |
| Offering | `default` (current) with **weekly** + **annual** packages | `lib/purchases.ts` → `loadOfferings()`, `app/paywall.tsx` (`offering.weekly` / `offering.annual`) |
| API key env var | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (must start with `appl_`) | `.env.local`, read in `lib/purchases.ts` |
| Test Store key env var (dev builds only) | `EXPO_PUBLIC_REVENUECAT_TEST_KEY` (must start with `test_`; wins over the `appl_` key when set) | `.env.local`, read in `lib/purchases.ts` behind `__DEV__` |
| Bundle ID | `com.podhorets.swipephotos` | `app.json` |
| Display prices | $4.99/week (3-day free trial), $29.99/year | Fallback in `constants/config.ts` → `FALLBACK_PRICING`; real prices come from the store once configured |

Suggested product IDs (used throughout this guide):

- `com.podhorets.swipephotos.pro.weekly` — $4.99/week, 3-day free trial intro offer
- `com.podhorets.swipephotos.pro.annual` — $29.99/year, no trial

---

## Part 1 — App Store Connect (appstoreconnect.apple.com)

### 1. Sign the Paid Applications agreement ⚠️ do this first
**Business (or Agreements, Tax, and Banking)** → Paid Apps agreement → accept, fill in
banking + tax info. Nothing else works until this is **Active** (bank verification can
take a few days — start now).

### 2. Create the app record (if not done yet)
**Apps → “+” → New App** → platform iOS, bundle ID `com.podhorets.swipephotos`
(register the bundle ID at developer.apple.com → Identifiers first if it's not listed).

### 3. Create the subscription group
App page → **Monetization → Subscriptions** → Create **Subscription Group**,
e.g. `Swipe Photos Pro`. (Both products go in the same group so Apple treats them as
upgrade/downgrade tiers of one subscription.)

### 4. Create the two subscription products
Inside the group, **Create Subscription**, twice:

**Weekly**
- Product ID: `com.podhorets.swipephotos.pro.weekly`
- Reference name: `Pro Weekly`
- Duration: **1 week**, Price: **$4.99** (Apple auto-fills other currencies)
- **Introductory Offer** → Free trial → **3 days**
- Localization (at least English): display name `Pro Weekly`, description e.g.
  “Unlimited sessions and 100-photo batches.”

**Annual**
- Product ID: `com.podhorets.swipephotos.pro.annual`
- Reference name: `Pro Annual`
- Duration: **1 year**, Price: **$29.99**
- Localization: display name `Pro Annual`.

Each product also needs a **review screenshot** (any paywall screenshot ≥ 640×920 works;
take one from the simulator) before it can be submitted — without it the product sits in
“Missing Metadata”. For sandbox testing “Missing Metadata” is fine; for App Review it isn't.

### 5. Create a sandbox tester
**Users and Access → Sandbox → Testers → “+”** — use an email you've never used with
Apple (aliases like `you+sandbox1@gmail.com` work). You'll sign in with this account
**on the device, in Settings → App Store → Sandbox Account** (not in the app) when testing.

### 6. Generate an In-App Purchase API key (for RevenueCat)
**Users and Access → Integrations → In-App Purchase** → Generate API Key → download the
`.p8` file, note the **Key ID** and **Issuer ID**. RevenueCat needs this to validate
receipts and pull products.

---

## Part 2 — RevenueCat dashboard (app.revenuecat.com)

### 7. Create the project + app
New Project (e.g. `Swipe Photos`) → **Add app → App Store** →
bundle ID `com.podhorets.swipephotos`.

### 8. Upload the ASC API key
In the app's config page → **App Store Connect API** section → upload the `.p8`,
enter Key ID + Issuer ID. Also paste the **App-Specific Shared Secret** if prompted
(ASC → App → App Information → Manage shared secret).

### 9. Import the products
**Product catalog → Products → “+ New”** (or “Import”) → both product IDs should appear
once ASC is connected:
- `com.podhorets.swipephotos.pro.weekly`
- `com.podhorets.swipephotos.pro.annual`

### 10. Create the entitlement — must be exactly `pro`
**Product catalog → Entitlements → “+ New”** → identifier **`pro`** → attach **both**
products to it. (The app checks `customerInfo.entitlements.active['pro']`.)

### 11. Create the offering
**Product catalog → Offerings** → the `default` offering exists already; make it
**current**. Add two **packages**:
- Package type **Weekly** (`$rc_weekly`) → weekly product
- Package type **Annual** (`$rc_annual`) → annual product

The paywall reads `offering.weekly` and `offering.annual`, which map to exactly these
standard package types.

### 12. Copy the public SDK key into the app
**Project settings → API keys** → copy the **Apple public key** (`appl_…`) →
paste into `.env.local`:

```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_XXXXXXXXXXXX
```

Then **restart Metro** (`pnpm start`) — `EXPO_PUBLIC_*` vars are inlined at bundle time.
No native rebuild needed (the SDK is already compiled in).

---

## Part 3 — Testing

### Stage A: no store setup at all (works today)
- Paywall shows fallback prices, purchase button shows “Purchases Unavailable”.
- All gating (2 sessions/day, batch 25, countdown chip) works — it's local.
- Settings → Developer → **Mock Pro entitlement** simulates a subscription (dev builds only).

### Stage B: RevenueCat Test Store (simulator, no ASC needed) — recommended for local dev
Simulated purchases through RevenueCat with no App Store Connect, no sandbox account and no
native changes. Works with `npx expo run:ios` on the simulator. The purchase sheet is
RevenueCat's simulated one, not Apple's.
1. RevenueCat dashboard → your project → **Apps** → **+ New** → **Test Store**.
2. In the Test Store app, create the two products with the **same IDs** as above
   (`com.podhorets.swipephotos.pro.weekly`, `…pro.annual`) and their prices/trial.
3. Attach both to the entitlement **`pro`**, and add them to the **`default`** offering as
   `$rc_weekly` and `$rc_annual` (same as steps 10–11).
4. Copy the Test Store app's public key (`test_…`) into `.env.local`, next to the production key:
   ```
   EXPO_PUBLIC_REVENUECAT_TEST_KEY=test_XXXXXXXXXXXX
   ```
5. **Restart Metro** (the value is inlined at bundle time). No rebuild needed.

In dev builds the `test_` key takes precedence over `appl_`; remove the line to test against
the real store. Release builds never read it (`__DEV__` guard in `lib/purchases.ts`).

### Stage B2: StoreKit Configuration file (Apple's real sheet) — optional
Only applies when you **run from Xcode** (Cmd+R). `npx expo run:ios` launches the app with
`simctl`, which ignores the scheme's StoreKit Configuration. `ios/` is regenerated by prebuild,
so the scheme setting is also lost on the next `expo run:ios`.
1. Xcode → open `ios/SwipePhotos.xcworkspace` → File → New → File → **StoreKit Configuration File** (check “Sync with App Store Connect” if ASC products exist, otherwise define the two products manually with the same IDs).
2. Product → Scheme → Edit Scheme → Run → Options → **StoreKit Configuration** → select the file.
3. Run from Xcode. Purchases complete against the local config (no real money, no sandbox account). In RevenueCat set **Project settings → Apps → StoreKit Config File** testing mode if you want RC to accept these receipts.

### Stage C: sandbox (real end-to-end, needs Parts 1–2 complete)
1. Build to a **physical device** (`npx expo run:ios --device`) — sandbox on simulator is unreliable for subscriptions.
2. Device: Settings → App Store → **Sandbox Account** → sign in with the tester from step 5.
3. In the app: exhaust free sessions → paywall → purchase weekly → Apple sandbox sheet → confirm.
4. Verify: paywall dismisses, sessions chip disappears, batch 50/100 unlock, Settings shows “Swipe Photos Pro — Active”; the purchase appears in RevenueCat → **Customers**.
5. Test **Restore Purchases**: delete + reinstall the app, open paywall → Restore.
6. Sandbox renewals are accelerated (1 week ≈ 3 min, 1 year ≈ 1 hour; a 3-day trial ≈ 2 min) — good for testing expiry: wait for it to lapse and confirm the app drops back to free (the foreground refresh in `app/_layout.tsx` handles this).

### Stage D: App Review notes (for later submission)
- The paywall already includes the Apple-required bits: price + renewal disclosure near the CTA, **Restore Purchases**, **Terms** (Apple standard EULA), **Privacy** links.
- Attach the product review screenshots (step 4) and submit the subscriptions **with** the app version.

---

## Quick checklist

- [ ] Paid Apps agreement **Active** (banking + tax done)
- [ ] App record with bundle `com.podhorets.swipephotos`
- [ ] Subscription group `Swipe Photos Pro`
- [ ] Product `…pro.weekly` $4.99/wk + 3-day trial, localized
- [ ] Product `…pro.annual` $29.99/yr, localized
- [ ] Sandbox tester created
- [ ] ASC In-App Purchase API key generated (.p8)
- [ ] RevenueCat project + iOS app, .p8 uploaded
- [ ] Products imported in RevenueCat
- [ ] Entitlement **`pro`** with both products
- [ ] Offering **`default`** (current) with `$rc_weekly` + `$rc_annual`
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…` in `.env.local`, Metro restarted
- [ ] (Local dev) Test Store app with the same products/entitlement/offering, `EXPO_PUBLIC_REVENUECAT_TEST_KEY=test_…` in `.env.local`
- [ ] Sandbox purchase + restore + expiry verified on device
