# Swipe Photos — Build Plan

A focused iOS app for cleaning up your photo library. Swipe left to delete, right to keep, up to favorite. Built with Expo, React Native, and NativeWind.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 54, managed workflow |
| Navigation | Expo Router v6 (file-based) |
| Styling | NativeWind v4 (Tailwind for RN) |
| Animations | React Native Reanimated 4 |
| Gestures | React Native Gesture Handler |
| Images | expo-image |
| Storage | react-native-mmkv v4 |
| State | Zustand + Immer |
| Async queries | TanStack Query |
| Glass UI | @shopify/react-native-skia |
| Media | expo-media-library |
| Auth | expo-local-authentication (Face ID) |
| Notifications | expo-notifications |
| Build | EAS Build + EAS Submit |

---

## Features

### Core
- **Swipe deck** — pan gesture with spring physics, rotate-on-drag, fly-off animation
- **Three decisions** — delete (left), keep (right), favorite (up)
- **Undo** — tap the header button within 3 s of each swipe
- **Stack animation** — cards behind the top card promote with a spring when swiped

### Categories
- By Year — pick a year, review all photos from that year
- By Month — pick a year + month
- On This Day — photos taken on today's date in past years
- Screenshots — detected by media subtype
- Videos — media type filter
- Favorites — iOS Favorites smart album
- Random Review — 50 random photos from the full library

### Trash & Deletion
- Staged deletions persist across app restarts (MMKV)
- Trash screen — 3-column grid, tap to deselect, select all/none
- Face ID gate on deletion (optional, toggled in Settings)
- `deleteAssetsAsync` triggers native iOS "Delete X Photos?" confirmation
- Deleted photos go to iOS Recently Deleted (30-day recovery)

### On This Day
- Section list grouped by year
- Horizontal photo strips per year
- Daily 9 AM push notification with deep link

### Settings
- Batch size (10 / 25 / 50 / 100)
- Face ID toggle (requires auth to enable)
- Notifications toggle
- Staged count with link to Trash
- Clear all staged
- App version info

### UI / Polish
- Full glass UI — `GlassCard`, `BlurPanel`, `GlassSheet` on every surface
- Skia gradient border + inner glow on cards
- Blurred dynamic background in review screen (cross-dissolves between photos)
- Skeleton shimmer while indexing
- Session complete sheet — staggered stats, confetti
- Action overlay labels pulse at swipe threshold
- Spring press on all interactive elements

### Edge Cases
- Permission denied → locked home screen with Settings deep link
- Limited photo access → yellow banner with count + Settings deep link
- Empty category → tap shows "Nothing Here" alert instead of navigating
- External deletion during session → card auto-skipped
- Already-deleted asset in Trash → silently removed from staged
- Very large libraries → paginated indexer (500/page) with `InteractionManager` yield between pages

---

## Day-by-Day Build Log

### Day 1 — Project scaffold
Expo + NativeWind + Expo Router + MMKV + Zustand. Tab navigation, onboarding flow, photo library permission request, MMKV-backed gallery indexer with progress indicator.

### Day 2 — Gallery indexer + home screen
Full paginated indexer (`lib/gallery/indexer.ts`), grouper functions for all 7 categories, home screen with category cards, storage summary, year/month pickers.

### Day 3 — Swipe engine
`SwipeCard` with pan + double-tap gesture, `SwipeStack` with 3-card stack, `ActionOverlay` with opacity/scale driven by translateX, session store, session factory, `useSession` hook.

### Day 4 — Trash + settings + On This Day
Trash screen (grid, Face ID gate, deleteAssetsAsync), settings screen (batch size, Face ID, notifications), On This Day screen (SectionList + horizontal strips), daily notification scheduling.

### Day 5 — Glass UI system
`GlassCard` with Skia gradient border + inner glow, `BlurPanel`, `GlassSheet`, applied across all screens and components.

### Day 6 — Polish
Blurred dynamic background in review screen, undo button in header, skeleton shimmer, session complete sheet (staggered stats, confetti), action overlay label pump animation, stack promote spring tuning.

### Day 7 — QA + EAS build
Edge case handling, app.json hardening, EAS build configuration, TestFlight submission.

---

## File Structure

```
app/
  _layout.tsx           Root layout, notification bootstrap
  index.tsx             Entry — redirects to tabs or onboarding
  onboarding.tsx        3-slide permission request flow
  (tabs)/
    _layout.tsx         Tab bar with blur background
    index.tsx           Home — category grid
    on-this-day.tsx     On This Day section list
    settings.tsx        Settings screen
  review/
    [sessionId].tsx     Swipe session screen
    preview/[assetId].tsx  Full-screen photo preview
  trash.tsx             Staged deletion screen

components/
  glass/                GlassCard, BlurPanel, GlassSheet
  swipe/                SwipeCard, SwipeStack, ActionOverlay
  ui/                   CategoryCard, SkeletonTile, ProgressBar, ActionButton,
                        SessionCompleteSheet, StorageSummary, ErrorBoundary

stores/
  galleryStore.ts       Photo index + favorites
  sessionStore.ts       Active swipe session
  deletionStore.ts      Staged deletions (MMKV-persisted)
  settingsStore.ts      User preferences (MMKV-persisted)

lib/
  gallery/
    indexer.ts          Paginated MediaLibrary indexer
    grouper.ts          Category filter functions
  notifications.ts      On This Day scheduling

hooks/
  useSession.ts         Session actions + derived state
  usePermissions.ts     Media + notification permission state
  useGalleryIndex.ts    Indexer bootstrap + MediaLibrary change listener
  useSpringPress.ts     Reusable spring press animation

constants/
  theme.ts              SPRING.*, SWIPE.*, GLASS.* constants
  config.ts             SESSION.* constants

assets/
  animations/
    confetti.json       Lottie confetti (12 particles, 3 s)
```

---

## EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Development build (installs Expo Dev Client on device)
eas build --platform ios --profile development

# Preview build (ad-hoc, for internal TestFlight)
eas build --platform ios --profile preview

# Production build (App Store distribution)
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios
```

---

## Manual QA Checklist

- [ ] Fresh install: onboarding → permissions → home → all 7 sessions
- [ ] Delete photos → verify iOS Recently Deleted
- [ ] Undo after each swipe type (delete / keep / favorite)
- [ ] Kill app mid-session → reopen → staged items preserved
- [ ] Notifications: verify scheduling at 9 AM next day
- [ ] Face ID: enable in settings, confirm trash requires auth
- [ ] Limited access: grant limited photos, verify yellow banner
- [ ] Permission denied: revoke in Settings, verify locked home screen
- [ ] Empty category: tap a 0-count card, verify alert
- [ ] Very large library: index completes without freeze
- [ ] Dark mode renders correctly on all screens
