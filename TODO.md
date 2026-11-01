# To-do — things only you can do

Accounts, hosting, store setup and other steps that can't be done from the code.
Claude adds to this list whenever something new needs your action. Tick items off
as you go. Details and ready-to-paste text: [docs/APP_STORE_SUBMISSION.md](docs/APP_STORE_SUBMISSION.md).

_Last updated: 2026-11-01_

## Before submitting to App Review

- [ ] **1. Host the privacy policy and support page.**
      `swipephotos.app` doesn't resolve today, and a dead privacy link is an automatic rejection (5.1.1).
      Upload [docs/legal/privacy.html](docs/legal/privacy.html) to `https://swipephotos.app/privacy` and
      [docs/legal/support.html](docs/legal/support.html) to `https://swipephotos.app/support`
      (GitHub Pages, Netlify or Cloudflare Pages all work). Open both on a phone afterwards.
      Using different URLs? Tell Claude, or change `LEGAL` in [constants/config.ts](constants/config.ts).

- [ ] **2. Create the mailbox `support@swipephotos.app`.**
      Both pages list it as the contact. Or pick another address and have it replaced in both pages.

- [ ] **3. Add the production RevenueCat key in EAS.**
      Without it, the App Store build can't load prices and the paywall fails review (2.1).
      ```bash
      eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_XXXX --visibility sensitive
      ```
      Also in RevenueCat: connect the App Store app with an In-App Purchase key (.p8).

- [ ] **4. Set up App Store Connect.**
  - [ ] Paid Apps Agreement active, with banking and tax complete.
  - [ ] Subscription group **Swipe Photos Pro** with both products:
        `com.podhorets.swipephotos.pro.weekly` (1 week, $4.99, introductory offer: free for 3 days) and
        `com.podhorets.swipephotos.pro.annual` (1 year, $29.99).
  - [ ] Display name, description and a review screenshot (the paywall) for each, until both show "Ready to Submit".
  - [ ] On the version page, select both subscriptions before "Add for Review". They can't be attached after a rejection.
  - [ ] Set the release to **Manual**.

- [ ] **5. Paste the metadata.**
      Name *Swipe Photos: Photo Cleaner*, subtitle, keywords, promotional text, description (it must keep the
      Terms of Use link), privacy label answers, review notes and 6 screenshots.
      All written out in Parts 2–4 of the submission guide.
  - [ ] Make the first two screenshots the Similar grid and a Similar group, not a plain swipe card
        (the order is in Part 2). Photo cleaners are a crowded category; this shows what's different.
  - [ ] Record a 30–60 second screen recording of the Similar flow and the Trash review, and attach it
        to the review notes. Keep it for a reply if Apple rejects under 4.3 (spam).

- [ ] **6. After uploading the build.**
  - [ ] Check your email for ITMS-91053 / 91061 (privacy manifest) warnings, and send them to Claude to fix.
  - [ ] Install it from TestFlight on an iPad once; reviewers often test on one.

## If App Review rejects

- [ ] **Under 4.3 (Design: Spam):** reply in App Store Connect with the template in Part 4 of the submission
      guide and attach the screen recording. Check that its claims are true for you (for example, that this is
      the only app of its kind on your account) before sending. If that fails, appeal to the App Review Board.
- [ ] **Anything else:** send Claude the rejection text.

## After approval

- [ ] Send Claude the App Store ID (the number in the app's App Store URL) to set `APP_STORE_ID`.
      This turns on the "Rate Swipe Photos" row in Settings.
