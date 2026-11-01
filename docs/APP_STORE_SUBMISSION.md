# App Store Submission — Swipe Photos 1.0

Everything needed to pass App Review on the first attempt. The code side is done
(see "What the app already does" at the end); this document covers what must be
set up outside the code, plus ready-to-paste metadata. Work through
**Part 1 (blockers)** before uploading a build.

---

## Part 1 — Blockers (submission fails without these)

- [ ] **Host the privacy policy and support page.** `https://swipephotos.app` does not
      resolve today, and a dead privacy link is an automatic 5.1.1(i) rejection.
      Publish `docs/legal/privacy.html` at `https://swipephotos.app/privacy` and
      `docs/legal/support.html` at `https://swipephotos.app/support` (any static host:
      GitHub Pages, Netlify, Cloudflare Pages). If you use different URLs, change
      `LEGAL` in `constants/config.ts` and the URLs below. Open both on a phone before submitting.
- [ ] **Create the mailbox `support@swipephotos.app`** (used in both pages), or replace it.
- [ ] **Production RevenueCat key in EAS.** `.env.local` is not used by EAS builds, and the key is empty
      there anyway. Without it the paywall cannot load products, and Apple rejects under 2.1.
      ```
      eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_XXXX --visibility sensitive
      ```
      (`eas.json` production profile now uses `"environment": "production"`.) Never put the
      `test_` key in production: it is ignored outside dev builds by `lib/purchases.ts`.
- [ ] **Paid Apps Agreement** active in App Store Connect (Business), with banking and tax complete.
- [ ] **Subscriptions in App Store Connect** (Monetization › Subscriptions):
  - Group: **Swipe Photos Pro** (add the localized group display name)
  - `com.podhorets.swipephotos.pro.weekly` — 1 week, $4.99, **Introductory Offer: Free, 3 days**, new subscribers
  - `com.podhorets.swipephotos.pro.annual` — 1 year, $29.99, no offer
  - Each needs a display name ("Swipe Photos Pro Weekly" / "Swipe Photos Pro Yearly"), a description,
    and an **App Review screenshot** (screenshot of the paywall). Status must be "Ready to Submit".
- [ ] **RevenueCat:** App Store app connected with an In-App Purchase key (.p8). The two products
      attached to entitlement `pro`, and offering `default` with `$rc_weekly` / `$rc_annual`. This is already
      configured for the Test Store; the App Store products show "Could not check" until the key is uploaded.
- [ ] **Submit the subscriptions together with the first version.** On the version page, under
      "In-App Purchases and Subscriptions", select both before "Add for Review". You can't attach them to a
      resubmission after a 2.1(b) rejection, so do it the first time.
- [ ] **Build** with Xcode 26 / iOS 26 SDK (EAS default image). Set **Manual release** for this version.
- [ ] After upload, **check your email for ITMS-91053 / 91061** (privacy manifest) warnings and fix them before submitting.
- [ ] **Test on an iPad** via TestFlight. The app is iPhone-only, but reviewers often run it on an iPad
      in compatibility mode.

After approval: set `APP_STORE_ID` in `constants/config.ts` (enables the "Rate Swipe Photos" row).

---

## Part 2 — App information (paste into App Store Connect)

| Field | Value | Notes |
|---|---|---|
| Name (30) | **Swipe Photos: Photo Cleaner** | "Brand: descriptor" is the pattern competitors pass with. Fallback if taken: *Swipe Photos – Library Cleaner*. The home-screen name stays "Swipe Photos" (similar enough for 2.3.8). |
| Subtitle (30) | **Swipe to Keep or Delete Photos** | No prices, no "free", no "#1", no "AI". |
| Primary category | Photo & Video | |
| Secondary category | Utilities | |
| Age rating | 4+ | Answer "None" to every content question; no user-generated content, no web browser, no social features. |
| Copyright | 2026 Dmytro Podhorets | |
| Privacy Policy URL | https://swipephotos.app/privacy | Must be live. |
| Support URL | https://swipephotos.app/support | Must be live and contain contact info. |
| Marketing URL | (optional) | |
| License Agreement | Apple's Standard EULA | Keep the default. The description must still link to it (below). |

**Keywords (100):**
```
cleaner,cleanup,storage,duplicate,similar,gallery,camera roll,declutter,organize,delete,memories
```
Don't repeat words from the name; no competitor or brand names (2.3.7).

**Promotional text (170):**
```
Clear your camera roll one swipe at a time. Review a month, a random stack or today's memories, group look-alike shots, and delete with confidence.
```

**Description:**
```
Swipe Photos makes cleaning up your photo library quick and calm. Swipe left to delete, swipe right to keep — one photo at a time.

REVIEW YOUR WAY
• Random stacks for a quick 5-minute session
• Go month by month through your whole library
• On This Day: revisit photos taken on today's date in past years
• Similar photos: look-alike shots grouped together, with the sharpest one suggested as the best

NOTHING IS DELETED BY ACCIDENT
• Photos you swipe left go to a Trash you review before anything is deleted
• iOS asks you to confirm every deletion
• Deleted photos stay in the Photos app's Recently Deleted album for 30 days
• Optional Face ID lock before deleting

PRIVATE BY DESIGN
• Your photos are never uploaded — everything happens on your iPhone
• No account needed

SWIPE PHOTOS PRO
Swipe Photos is free to use with 2 reviews per day of up to 25 photos each. Swipe Photos Pro is an optional auto-renewable subscription that unlocks unlimited reviews and up to 100 photos per review.
• Weekly: includes a 3-day free trial for new subscribers, then billed weekly
• Yearly: billed once a year
Payment is charged to your Apple ID at confirmation of purchase (or when the free trial ends). The subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store account settings.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://swipephotos.app/privacy
```
The EULA link must be in the description of **every** localization (3.1.2).

**What's New (1.0):** `First release.`

### Screenshots (6.9" — 1320 × 2868, required)
Capture from the iPhone 17 Pro Max simulator with `npm run seed:photos` data, all from the real app UI:
1. Swipe card mid-swipe with the KEEP overlay — caption "Swipe right to keep"
2. Swipe card with the DELETE overlay — "Swipe left to delete"
3. Trash review grid — "Check everything before it's deleted"
4. Similar groups with the Best badge — "Find look-alike shots"
5. By Month list — "Go through your library month by month"
6. On This Day — "Revisit today in past years"

Rules: no prices, "free" or discount claims in screenshots (2.3.14). No device frames from other brands. Status bar clean. Only features that exist.

---

## Part 3 — App Privacy (nutrition label)

"Do you or your third-party partners collect data from this app?" → **Yes**. Tracking: **No** for every type, and
no ATT prompt. Linked to user: **No** for every type.

| Data type | Collected by | Purposes |
|---|---|---|
| Diagnostics › Crash Data | Sentry | App Functionality |
| Diagnostics › Other Diagnostic Data | Sentry | App Functionality |
| Usage Data › Product Interaction | PostHog (only if `EXPO_PUBLIC_POSTHOG_KEY` is set) | Analytics |
| Purchases › Purchase History | RevenueCat | App Functionality |

Not collected: Photos or Videos (never leave the device; Sentry replays mask all images and text), Contact Info,
Location, Identifiers used for tracking. These match `ios.privacyManifests` in `app.json`.

---

## Part 4 — App Review Information

- Sign-in required: **No** (no accounts)
- Contact: your name, phone, email
- **Notes** (paste; attach a screen recording of the flow if possible):

```
Swipe Photos is a photo-library cleaner. No account or login is required.

HOW IT WORKS
1. On first launch, three intro screens explain the app; "Continue" on the last one shows the iOS photo-library permission prompt.
2. Library tab → tap "Random 25" (or a month on the Months tab). Swipe right to keep, left to mark for deletion; or use the buttons.
3. Close the session (X) → "Review Trash" → Delete. Photos are deleted with PHPhotoLibrary, so iOS shows its own confirmation, and the photos go to Recently Deleted (recoverable for 30 days).
4. Similar tab groups look-alike shots (taken within seconds of each other; on device, Apple Vision feature prints refine the groups and pick the sharpest shot). To see a group, take 3–4 quick photos of the same scene.
5. On This Day (third tab) shows photos taken on today's date in previous years.

WHY FULL PHOTO LIBRARY ACCESS
The app's purpose is reviewing and deleting photos across the whole library, which the limited PHPicker cannot do. If the user chooses Limited Access, the app works with the selected photos and offers a banner to choose more (presentLimitedLibraryPicker). If access is denied, the Library tab explains and links to Settings. All analysis runs on device; photos are never uploaded.

SUBSCRIPTION (Swipe Photos Pro)
The free plan allows 2 reviews per day of up to 25 photos. Pro (weekly with a 3-day free trial for new subscribers, or yearly) unlocks unlimited reviews and up to 100 photos per review. To reach the paywall: Settings → Swipe Photos Pro, or start a third review on the same day. Restore Purchases is on the paywall and in Settings. Terms of Use and Privacy Policy are linked on the paywall and in Settings.

The app is iPhone-only and supports iPad compatibility mode. Tested on iPhone 17 Pro (iOS 26.2).
```

---

## Part 5 — What the app already does (implemented in code)

- **Permission pre-prompt:** a single "Continue" button that always leads to the iOS prompt. No "Allow" wording, no skip (5.1.1(iv), HIG Privacy).
- **Purpose strings:** one-sentence, specific `NSPhotoLibraryUsageDescription` and `NSFaceIDUsageDescription`. The unused add-only photo permission was removed.
- **Denied / limited access:** Library shows "Continue" (if iOS can still ask) or "Open Settings". The limited-access banner opens the system picker.
- **Paywall (3.1.2 / 5.6):**
  - Subscription name and benefits are always shown. The billed price is the largest price on each plan.
  - The per-week price and "SAVE x%" are computed from store prices and shown smaller.
  - The trial length comes from the product's introductory offer and is shown only if the user is eligible.
  - Full auto-renew disclosure under the button. The button reads "Continue".
  - The close button is visible immediately. Restore, Terms of Use and Privacy Policy are visible at 44 pt.
  - If the store can't be reached, an error with Try Again is shown, never invented prices.
- **No unkept promises:** removed the "Day 2 reminder" (never sent), "10× faster", "hundreds a minute", "On-device AI", "100% on-device / No uploads", and the 4.8★ rating claim. "Storage freed" now says photos moved to Recently Deleted.
- **Settings:** Manage subscription (Apple sheet), Restore Purchases, Help & Support, Privacy Policy, Terms of Use. "Rate" is hidden until `APP_STORE_ID` is set.
- **Release safety:** the Developer section (Mock Pro) exists only in dev builds. The crash screen shows no stack traces and reports to Sentry. Sentry sends no PII and records no routine sessions; the analytics toggle covers it.
- **Licensed, bundled demo images** (Unsplash License) instead of hot-linked social-media photos.
- **Privacy manifest** in `app.json`: required-reason APIs (UserDefaults, FileTimestamp, SystemBootTime, DiskSpace) and collected data types.
