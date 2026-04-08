# SwipeClean — 7-Day iOS Build Plan

## Context
Building SwipeClean from a blank directory. iOS-only Expo app for swipe-based photo cleanup. Premium "Liquid Glass" UI with tactile animations. No duplicate detection. All processing on-device. Goal: fully functional MVP on TestFlight by end of Day 7, working together commit by commit.

---

## Principles

- **Real device from Day 1.** Expo Dev Client on physical iPhone. Never trust simulator for animations or gestures.
- **Glass UI is not decorative — it ships on Day 1.** `GlassCard` and `BlurPanel` primitives are built on Day 1 and used everywhere from the start.
- **Swipe mechanics before data.** Build the gesture deck with mock cards on Day 3, connect to real gallery on Day 4. This lets us tune feel without fighting data.
- **Small, shippable commits.** Each commit leaves the app in a working state. No "WIP" commits.
- **Zustand for everything stateful.** No prop-drilling, no Context for state.
- **Never block the UI thread.** Gallery indexing runs in chunks via `InteractionManager`. Animations are Reanimated worklets.
- **No abstraction until the third use.** Don't create helpers for one-off operations.

---

## Final Tech Stack (locked)

| Concern | Library | Version |
|---|---|---|
| Framework | `expo` (managed + prebuild) | ~52.x |
| Language | TypeScript | ~5.x (strict) |
| Navigation | `expo-router` | ~4.x |
| State | `zustand` | ~5.x |
| Async state | `@tanstack/react-query` | ~5.x |
| Animations | `react-native-reanimated` | ~3.x |
| Gestures | `react-native-gesture-handler` | ~2.x |
| Blur / glass | `expo-blur` | ~14.x |
| Custom drawing | `@shopify/react-native-skia` | ~1.x |
| Images | `expo-image` | ~2.x |
| Haptics | `expo-haptics` | ~14.x |
| Fast storage | `react-native-mmkv` | ~3.x |
| Photo access | `expo-media-library` | ~16.x |
| Face ID | `expo-local-authentication` | ~15.x |
| Notifications | `expo-notifications` | ~0.29.x |
| Celebration anim | `lottie-react-native` | ~7.x |
| Immer | `immer` | ~10.x |
| Build / OTA | EAS Build + EAS Update | latest CLI |

**No custom native modules.** `expo-media-library` covers indexing, deletion (via system dialog), and smart album (Favorites) access. `expo-local-authentication` covers Face ID. All other gaps are handled in JS.

---

## Project Structure

```
swipe-photos/
├── app/                             # Expo Router — all routes
│   ├── _layout.tsx                  # Root: GestureHandlerRootView, QueryClientProvider
│   ├── index.tsx                    # Redirect: onboarding if new, (tabs) if ready
│   ├── onboarding.tsx               # Full-screen onboarding modal
│   ├── (tabs)/
│   │   ├── _layout.tsx              # Tab bar layout (glass tab bar)
│   │   ├── index.tsx                # Home screen
│   │   ├── on-this-day.tsx          # On This Day screen
│   │   └── settings.tsx             # Settings screen
│   ├── review/
│   │   └── [sessionId].tsx          # Swipe review screen (full-screen modal)
│   └── trash.tsx                    # Trash / pending deletions screen
│
├── src/
│   ├── components/
│   │   ├── glass/
│   │   │   ├── GlassCard.tsx        # Core: BlurView + border + shadow
│   │   │   ├── GlassSheet.tsx       # Bottom sheet variant
│   │   │   └── BlurPanel.tsx        # Simple blurred background panel
│   │   ├── swipe/
│   │   │   ├── SwipeCard.tsx        # Single animated swipe card
│   │   │   ├── SwipeStack.tsx       # 3-card parallax stack manager
│   │   │   └── ActionOverlay.tsx    # DELETE / KEEP / FAV tint overlays
│   │   ├── media/
│   │   │   ├── PhotoTile.tsx        # expo-image tile with blurhash
│   │   │   └── VideoThumbnail.tsx   # Video tile with duration badge
│   │   └── ui/
│   │       ├── CategoryCard.tsx     # Home screen category entry
│   │       ├── ProgressBar.tsx      # Session progress (Reanimated)
│   │       ├── StorageSummary.tsx   # Storage used / reclaimable banner
│   │       ├── ActionButton.tsx     # Keep / Delete / Fav buttons
│   │       └── UndoPill.tsx         # Floating undo pill (auto-dismiss)
│   │
│   ├── stores/
│   │   ├── galleryStore.ts          # Asset index, counts per category
│   │   ├── sessionStore.ts          # Active swipe session state machine
│   │   ├── deletionStore.ts         # Pending / confirmed deletions
│   │   └── settingsStore.ts         # User preferences (MMKV-persisted)
│   │
│   ├── hooks/
│   │   ├── useGalleryIndex.ts       # Build + subscribe to gallery index
│   │   ├── useSession.ts            # Create and progress through a session
│   │   ├── useHaptic.ts             # Typed haptic helpers
│   │   └── usePermissions.ts        # Photo + notification permission state
│   │
│   ├── lib/
│   │   ├── gallery/
│   │   │   ├── indexer.ts           # Paginated MediaLibrary fetch → MMKV cache
│   │   │   └── grouper.ts           # Category grouping logic (all 7 modes)
│   │   ├── session/
│   │   │   └── sessionFactory.ts    # Build session asset list from category
│   │   └── dateUtils.ts             # "On This Day" filter, MM-DD helpers
│   │
│   ├── constants/
│   │   ├── theme.ts                 # Colors, spacing, radii, glass constants
│   │   └── config.ts                # Batch size, swipe thresholds, cache keys
│   │
│   └── types/
│       └── index.ts                 # AssetMeta, Session, Category, etc.
│
├── assets/
│   ├── animations/
│   │   └── confetti.json            # Lottie: session complete celebration
│   └── images/
│       └── icon.png
│
├── PLAN.md                          # This file (committed to repo)
├── app.json
├── tsconfig.json
├── babel.config.js
└── package.json
```

---

## Day-by-Day Plan

---

### Day 1 — Foundation: Project, Navigation, Theme, Glass Primitives, Onboarding

#### Goal
A real Expo Dev Client build running on device. Correct navigation shell (tabs + modals). Theme system. GlassCard component looking beautiful. Onboarding screen with photo permission request.

#### Features
- Expo project initialized, iOS-only, all deps installed
- Expo Router tabs + modal stack wired
- `theme.ts` with all colors, spacing, glass constants
- `GlassCard`, `BlurPanel`, `GlassSheet` components
- Onboarding: 3 steps (welcome, value prop, permission)
- Permission flow: request photos + notifications
- EAS project linked

#### Step-by-Step Tasks

1. Run: `npx create-expo-app@latest swipe-photos --template blank-typescript`
2. Edit `app.json`:
   - Set `name: "SwipeClean"`, `slug: "swipe-clean"`
   - Set `ios.bundleIdentifier: "com.swipeclean.app"`
   - Set `ios.supportsTablet: false`
   - Remove `android` block entirely
   - Add plugins: `expo-router`, `expo-media-library`, `expo-blur`, `expo-local-authentication`, `expo-notifications`
3. Install all dependencies (single `npm install` command with full dep list)
4. Configure `tsconfig.json` with `strict: true`, `paths` alias for `@/` → `./src/`
5. Configure `babel.config.js` with Reanimated plugin (must be last)
6. Set `"main": "expo-router/entry"` in `package.json`
7. Create `src/constants/theme.ts` — define all glass constants (blur intensity, border color, border radius, spacing, color palette)
8. Create `src/constants/config.ts` — batch size (50), swipe threshold (0.35), MMKV keys
9. Create `src/types/index.ts` — `AssetMeta`, `Category`, `Session`, `SwipeDecision` types
10. Create `app/_layout.tsx` — wrap with `GestureHandlerRootView`, `QueryClientProvider`
11. Create `app/(tabs)/_layout.tsx` — glass tab bar, 3 tabs (Home, On This Day, Settings)
12. Create placeholder screens: `app/(tabs)/index.tsx`, `app/(tabs)/on-this-day.tsx`, `app/(tabs)/settings.tsx`
13. Create `app/review/[sessionId].tsx` placeholder
14. Create `app/trash.tsx` placeholder
15. Create `src/components/glass/GlassCard.tsx` — `BlurView` + white border + shadow + `borderRadius`
16. Create `src/components/glass/BlurPanel.tsx` — full-bleed blur background
17. Create `src/components/glass/GlassSheet.tsx` — bottom-aligned glass panel
18. Create `app/onboarding.tsx` — 3-step flow: Welcome → Value prop → Request permissions
19. Create `src/hooks/usePermissions.ts` — `requestMediaLibraryPermission`, `requestNotificationsPermission`, `hasFullAccess` check
20. Create `app/index.tsx` — redirect to onboarding (if first launch via `settingsStore`) or `(tabs)`
21. Run `npx expo prebuild --platform ios --clean`
22. Run `npx expo run:ios --device` to verify on real device
23. Link EAS project: `eas init`

#### Commits
1. `chore: init expo project, ios-only app.json, install all dependencies`
2. `chore: tsconfig strict, babel reanimated plugin, expo-router entry`
3. `feat: theme system and shared types (GlassCard, BlurPanel, GlassSheet)`
4. `feat: expo router shell — tabs layout, modal stack, placeholder screens`
5. `feat: onboarding screen with photo and notification permission request`
6. `feat: index redirect logic (first launch vs returning user)`

#### Manual Testing (device)
- App opens without crash on real iPhone
- Tab bar renders with 3 tabs, glass blur visible
- Onboarding appears on first launch
- "Allow Access" grants photo library permission (check Settings to confirm)
- After granting, redirects to Home tab
- Second launch skips onboarding

---

### Day 2 — Gallery Engine + Home Screen

#### Goal
The gallery index is built on launch. Home screen shows all 7 categories with real counts pulled from device library.

#### Features
- `indexer.ts`: paginated `getAssetsAsync` in 500-asset chunks, stores metadata in MMKV
- `grouper.ts`: groups index by Year, Month, On This Day, Screenshots, Videos, Favorites, Random
- `galleryStore.ts`: Zustand store with category counts, loading state
- `useGalleryIndex.ts`: hook that triggers indexing and subscribes to change events
- Home screen: StorageSummary card + 7 CategoryCards with real counts
- `CategoryCard` component with glass style, category icon, count badge
- `StorageSummary` component showing total photos, estimated reclaimable size

#### Step-by-Step Tasks

1. Create `src/types/index.ts` — finalize `AssetMeta` type (id, uri, creationTime, mediaType, filename, width, height, duration, albumIds)
2. Create `src/lib/gallery/indexer.ts`:
   - `buildIndex()`: paginate `MediaLibrary.getAssetsAsync({ first: 500, after: cursor })` until exhausted
   - Use `InteractionManager.runAfterInteractions` between chunks to avoid jank
   - Extract `AssetMeta` from each asset
   - Serialize to MMKV as `gallery:index` (array of AssetMeta, JSON)
   - Expose `loadCachedIndex()` to hydrate from MMKV on startup
   - Subscribe to `MediaLibrary.addListener` for incremental updates (re-index changed assets)
3. Create `src/lib/gallery/grouper.ts`:
   - `getByYear(index)` → `Map<number, AssetMeta[]>`
   - `getByMonth(index)` → `Map<string, AssetMeta[]>` (key: `"YYYY-MM"`)
   - `getOnThisDay(index, date)` → `AssetMeta[]` (filter by `MM-DD === today`)
   - `getScreenshots(index)` → detect by filename pattern + common screenshot dimensions (430×932, 393×852, 430×932, 414×896, 390×844, 428×926, 375×812)
   - `getVideos(index)` → `mediaType === "video"`, sort by duration desc
   - `getFavorites(index, favoriteIds)` → join against a Set of known favorite IDs (sourced from Favorites smart album)
   - `getRandom(index, count = 50)` → Fisher-Yates shuffle, take `count`
4. Create `src/lib/gallery/indexer.ts` — add `fetchFavoriteIds()`: call `MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })`, find album named "Favorites", fetch its asset IDs
5. Create `src/stores/galleryStore.ts`:
   - State: `index: AssetMeta[]`, `favoriteIds: Set<string>`, `isIndexing: boolean`, `indexProgress: number`, `lastIndexed: number`
   - Actions: `setIndex`, `setFavoriteIds`, `setIndexing`, `addAssets`, `removeAssets`
   - Computed (derived via selectors): `countByCategory`
6. Create `src/hooks/useGalleryIndex.ts`:
   - On mount: load MMKV cache → set into store immediately
   - Then run `buildIndex()` in background, updating progress
   - Subscribe to MediaLibrary changes
7. Create `src/components/ui/StorageSummary.tsx`:
   - Glass card showing total photo count and estimated file size (sum of asset sizes if available, otherwise omit)
   - "X photos in your library" headline
8. Create `src/components/ui/CategoryCard.tsx`:
   - GlassCard with category name, SF Symbols-compatible icon (use `@expo/vector-icons` Ionicons), count badge, chevron
   - Press animates scale 0.96 → 1 with spring (Reanimated `useAnimatedStyle`)
   - Haptic on press: `selectionAsync`
9. Create `src/components/ui/Badge.tsx` — count pill with glass style
10. Update `app/(tabs)/index.tsx` — Home screen:
    - Use `useGalleryIndex` hook
    - Render `StorageSummary` at top
    - Render 7 `CategoryCard` items in a `ScrollView`
    - Show skeleton/loading state while indexing (`isIndexing`)
    - Trash badge in header showing pending deletion count
    - Each CategoryCard navigates to `review/[sessionId]` with category param
11. Wire `useGalleryIndex` call in `app/(tabs)/_layout.tsx` (so indexing starts when app enters tabs, not when Home mounts)

#### Commits
1. `feat: gallery indexer — paginated media library scan with MMKV caching`
2. `feat: gallery grouper — all 7 category grouping functions`
3. `feat: galleryStore + useGalleryIndex hook with change subscription`
4. `feat: home screen — StorageSummary and CategoryCard components`
5. `feat: fetch favorites smart album and integrate into galleryStore`

#### Manual Testing (device)
- Home screen loads and shows real photo count
- All 7 categories show non-zero counts (if photos exist in each)
- StorageSummary shows correct total
- Tapping a category navigates (to placeholder review screen for now)
- Kill and reopen: index loads from MMKV instantly, background re-index runs silently
- Take a new photo: home count updates within a few seconds

---

### Day 3 — Swipe Session: Deck, Gestures, Animations, Haptics

#### Goal
The swipe review experience is feature-complete and silky smooth using mock data. Every swipe gesture, overlay, animation, and haptic is tuned to feel premium.

#### Features
- `SwipeStack` component: 3-card parallax stack
- `SwipeCard`: `PanGestureHandler` + Reanimated worklet, spring physics
- `ActionOverlay`: DELETE (red) / KEEP (green) / FAV (gold) tint ramps
- `ActionButton` row: manual tap alternatives to swipe
- `UndoPill`: floating undo with auto-dismiss
- `ProgressBar`: animated session progress
- Full haptic map wired
- Session screen header with progress and exit
- Double-tap to open full-screen photo preview

#### Step-by-Step Tasks

1. Create `src/stores/sessionStore.ts`:
   - State: `sessionId`, `assetIds: string[]`, `currentIndex: number`, `decisions: Map<string, 'delete'|'keep'|'favorite'>`, `undoStack: string[]` (last 10 asset IDs)
   - Actions: `startSession`, `decide`, `undoLast`, `nextCard`, `resetSession`
   - Computed: `currentAssetId`, `remainingCount`, `progressFraction`
2. Create `src/lib/session/sessionFactory.ts`:
   - `createSession(category, galleryStore)` → returns `Session` with ordered `assetIds[]`
   - For now, use `grouper.ts` functions. Returns a stable session ID (UUID via `expo-crypto` or `Math.random().toString(36)`)
3. Create `src/hooks/useSession.ts`:
   - Wraps sessionStore, exposes `swipeLeft`, `swipeRight`, `swipeUp`, `undoLast`
   - `swipeLeft` → `decide(id, 'delete')` + `deletionStore.stage(id)` + haptic Heavy
   - `swipeRight` → `decide(id, 'keep')` + haptic Medium
   - `swipeUp` → `decide(id, 'favorite')` + haptic Medium
   - `undoLast` → pop undo stack, un-stage if needed, haptic Light
4. Create `src/components/swipe/ActionOverlay.tsx`:
   - Takes `translateX: SharedValue<number>` as prop
   - DELETE overlay: `opacity = interpolate(translateX, [-THRESHOLD, 0], [1, 0])`, red tint `rgba(255,69,58,0.85)`
   - KEEP overlay: `opacity = interpolate(translateX, [0, THRESHOLD], [0, 1])`, green tint `rgba(52,199,89,0.85)`
   - Each overlay shows large icon + label text with bold SF Pro
5. Create `src/components/swipe/SwipeCard.tsx`:
   - `PanGestureHandler` wrapping `expo-image` thumbnail
   - Shared values: `translateX`, `translateY` (for up swipe: favorite)
   - `useAnimatedStyle`: `transform: [{ translateX }, { translateY }, { rotate: `${rotate}rad` }]`
   - rotate = `interpolate(translateX, [-width/2, 0, width/2], [-0.15, 0, 0.15])`
   - On gesture end: if |translateX| > THRESHOLD (35% screen width) → fly off (spring to ±500); else snap back
   - If translateY < -THRESHOLD_UP → fly up (swipe up = favorite)
   - Haptic at threshold crossing: track `hasPassedThreshold` flag, fire `impactAsync(Medium)` on first cross
   - On fly-off complete: call `onSwipe(direction)` callback
   - Double-tap gesture: open modal preview (pass `onDoubleTap` callback)
   - Props: `asset: AssetMeta`, `onSwipe: (dir) => void`, `onDoubleTap: () => void`, `zIndex`
6. Create `src/components/swipe/SwipeStack.tsx`:
   - Renders top 3 cards from `sessionStore.assetIds[currentIndex..currentIndex+2]`
   - Card 0 (top): full interaction, zIndex 3
   - Card 1: scale 0.96, translateY 10, opacity 0.85, zIndex 2, no interaction
   - Card 2: scale 0.92, translateY 20, opacity 0.70, zIndex 1, no interaction
   - When card 0 exits: animate cards 1,2 up with spring (`withSpring` on scale, translateY, opacity)
   - Prefetch next 5 assets via `expo-image` `prefetch()`
7. Create `src/components/ui/ActionButton.tsx`:
   - Three buttons: ✕ (delete), ✓ (keep), ★ (favorite)
   - Each: glass circle, icon, Reanimated scale press animation
   - Delete button larger than keep; favorite smaller
   - Haptic `selectionAsync` on press
8. Create `src/components/ui/UndoPill.tsx`:
   - Floating pill, centers horizontally, sits above action buttons
   - Appears with slide-up spring animation on each swipe
   - Auto-dismisses after 3s (Reanimated `withDelay(3000, withTiming(0))` on opacity)
   - Tap: calls `useSession().undoLast()`
9. Create `src/components/ui/ProgressBar.tsx`:
   - Thin bar at top of review screen
   - `width` animated with `withTiming(progressFraction * screenWidth, { duration: 300 })`
   - Color: white with opacity on dark glass background
10. Update `app/review/[sessionId].tsx`:
    - Read `sessionId` from route params
    - Use `useSession` hook
    - Layout: header (back + progress bar + category label + exit X), `SwipeStack`, `ActionButton` row, `UndoPill`
    - Background: blurred full-screen photo of current asset (subtle, dark) behind glass card
    - Double-tap → push to `review/preview/[assetId]` modal (simple full-screen image, pinch to zoom)
    - When `remainingCount === 0`: show session complete sheet
11. Create `app/review/preview/[assetId].tsx`:
    - Full-screen `expo-image` with pinch-to-zoom (Reanimated + GestureHandler)
    - Glass close button top-right
12. Wire up `sessionFactory.createSession` in category taps on Home screen — navigate with real sessionId

#### Commits
1. `feat: sessionStore and sessionFactory — session state machine`
2. `feat: SwipeCard — pan gesture with Reanimated worklet, spring physics, threshold haptics`
3. `feat: SwipeStack — 3-card parallax with animated promotion on card exit`
4. `feat: ActionOverlay — DELETE/KEEP/FAV tint ramps on drag`
5. `feat: ActionButton row, UndoPill auto-dismiss, ProgressBar`
6. `feat: review screen wired — header, full swipe session UX, preview modal`

#### Manual Testing (device)
- Swipe cards fly off smoothly at 60/120fps (no jank)
- Snap-back feels springy and natural (not rubber-band)
- DELETE overlay appears as card crosses left threshold (red wash)
- KEEP overlay appears crossing right threshold
- Haptic fires once at threshold, heavy haptic on release
- Card 2 and 3 animate forward when card 1 exits
- Undo pill appears after each swipe, tapping restores card
- Undo pill auto-dismisses after 3s
- Progress bar advances with each swipe
- Action buttons produce correct haptic + swipe animation
- Double-tap opens full-screen preview with pinch-zoom
- Up-swipe marks as favorite (overlay shows star/gold tint)

---

### Day 4 — Real Gallery Data + All Category Sessions + Deletion Store

#### Goal
All 7 category sessions work end-to-end with real photos. Deletion store accumulates staged assets. Trash screen shows pending items with restore + delete options.

#### Features
- `deletionStore.ts`: staged → confirmed, with MMKV persistence
- Trash screen: grid of staged assets, restore/delete per item, "Delete All" CTA
- Session complete sheet (with stats)
- All 7 session modes working with real data
- Face ID gate before bulk deletion
- `deleteAssetsAsync` wired (system confirmation dialog is intentional)
- `favoriteIds` from smart album integrated into Favorites category

#### Step-by-Step Tasks

1. Create `src/stores/deletionStore.ts`:
   - State: `staged: Set<string>` (assetIds), `confirmed: Set<string>`
   - Persist `staged` to MMKV key `deletion:staged` (serialize/deserialize Set as array)
   - Actions: `stage(id)`, `unstage(id)`, `confirmAll()`, `unstageAll()`
   - `stage()` also removes from `sessionStore`'s keep list (if undo isn't in play)
2. Create `src/stores/settingsStore.ts`:
   - State: `hasCompletedOnboarding: boolean`, `faceIdEnabled: boolean`, `batchSize: number`, `analyticsOptIn: boolean`, `notificationsEnabled: boolean`
   - Persist all to MMKV key `settings`
3. Verify `sessionFactory.ts` routes each category to correct `grouper.ts` function:
   - `year` → prompt user for which year (bottom sheet year picker), then `getByYear(index)[selectedYear]`
   - `month` → prompt for month, then `getByMonth(index)[selectedMonth]`
   - `on-this-day` → `getOnThisDay(index, new Date())`
   - `screenshots` → `getScreenshots(index)`
   - `videos` → `getVideos(index)`
   - `favorites` → `getFavorites(index, galleryStore.favoriteIds)`
   - `random` → `getRandom(index, batchSize)`
4. Create `src/components/ui/YearMonthPicker.tsx`:
   - Glass bottom sheet with a list of available years (or months)
   - Appears as modal before starting year/month session
   - Shows count per year/month
5. Create session complete bottom sheet component (`SessionCompleteSheet.tsx`):
   - Lottie confetti animation plays
   - Shows: X reviewed, X kept, X staged for deletion
   - Estimated MB savings (rough: staged count × average photo size, use 4MB default)
   - CTA: "Review Trash" → navigate to `/trash`; "Done" → dismiss to Home
   - Haptic: `notificationAsync(Success)`
6. Update `app/review/[sessionId].tsx` — trigger `SessionCompleteSheet` when `remainingCount === 0`
7. Create `app/trash.tsx`:
   - Header: "X Photos Staged" with glass blur background
   - `FlatList` 3-column grid of `PhotoTile` items from `deletionStore.staged`
   - Per-item: press → show action sheet (Restore / Delete this one)
   - "Restore All" text button in header
   - "Delete All" CTA at bottom (destructive red, glass)
   - "Delete All" flow:
     a. If `settingsStore.faceIdEnabled`: call `LocalAuthentication.authenticateAsync()`; abort if rejected
     b. Show native `Alert.alert` confirmation ("Move X photos to Recently Deleted?")
     c. On confirm: `MediaLibrary.deleteAssetsAsync(Array.from(staged))` — iOS system dialog fires here
     d. On success: `deletionStore.confirmAll()`, `galleryStore.removeAssets(confirmed)`, navigate back
     e. On failure: show error, items remain staged
8. Add trash badge to Home screen header (count from `deletionStore.staged.size`)
9. Wire Home header trash badge → navigate to `/trash`
10. Wire "Restore" per-item in trash: `deletionStore.unstage(id)`, item animates out of grid
11. Test all 7 category sessions end-to-end with real device photos
12. Verify `getFavorites` pulls correct assets from iOS Favorites smart album

#### Commits
1. `feat: deletionStore with MMKV persistence — stage, unstage, confirm`
2. `feat: settingsStore — preferences with MMKV persistence`
3. `feat: sessionFactory routes all 7 categories to correct grouper functions`
4. `feat: year/month picker sheet and session complete sheet with Lottie`
5. `feat: trash screen — grid, per-item restore, delete all with Face ID + system confirm`
6. `feat: home screen trash badge and end-to-end deletion flow wired`

#### Manual Testing (device)
- Start each of the 7 session types — correct photos appear
- Year/month picker shows correct counts
- Swipe left → item appears in Trash count
- Open Trash — correct photos grid shown
- Restore one item → disappears from trash
- "Delete All": Face ID prompt appears (if enabled), then iOS system dialog, then photos removed from library
- After deletion, Home count decreases
- Kill and reopen: staged items persist in Trash (MMKV)
- Session complete sheet shows correct stats, Lottie plays

---

### Day 5 — On This Day Screen + Notifications + Settings Screen

#### Goal
The On This Day tab is a rich year-by-year timeline. Notifications remind users daily. Settings screen is fully functional and persisted.

#### Features
- On This Day screen: scrollable timeline grouped by year, showing photos from this calendar date in past years
- Local notification: daily at 9 AM ("You have memories from X years ago")
- Settings screen: all toggles wired to `settingsStore`
- Face ID toggle (verify auth before enabling)
- Notification enable/disable toggle (request permission inline)
- Batch size control
- "Clear Trash" and "About" entries

#### Step-by-Step Tasks

1. Update `app/(tabs)/on-this-day.tsx`:
   - Call `getOnThisDay(index, new Date())` to get all assets for today's calendar date
   - Group by year (descending): `Map<number, AssetMeta[]>`
   - Render `SectionList` with year as section header
   - Each section: horizontal `FlatList` of `PhotoTile` items (thumbnail strip)
   - Tap year section CTA "Review [year]" → `sessionFactory.createSession('on-this-day-year', year)` → navigate to review screen
   - Empty state if no memories: friendly illustration + "No memories for today yet"
   - Glass section headers with year label + count badge
2. Create `src/lib/gallery/grouper.ts` — add `getOnThisDayByYear(index, date)` → `Map<number, AssetMeta[]>`
3. Create `src/lib/dateUtils.ts`:
   - `toMMDD(date: Date): string`
   - `isSameCalendarDay(a: Date, b: Date): boolean`
   - `yearsAgoLabel(year: number): string` (e.g. "3 years ago", "1 year ago")
4. Schedule "On This Day" notification:
   - Create `src/lib/notifications.ts`
   - `scheduleOnThisDayNotification()`: uses `expo-notifications` to schedule a daily trigger at 9:00 AM local time
   - Content: `"📷 You have memories from [N] year[s] ago today"` (compute count at scheduling time)
   - Cancel + reschedule on each app foreground
   - Call on app foreground via `AppState` listener in root `_layout.tsx`
5. Register notification response handler in `_layout.tsx`:
   - Tapping notification → navigate to `/(tabs)/on-this-day`
6. Update `app/(tabs)/settings.tsx`:
   - Sections: Review Preferences, Privacy & Security, Storage, About
   - **Review Preferences**: Batch size slider (25 / 50 / 100), auto-skip favorites toggle
   - **Privacy & Security**: Face ID toggle (requires `LocalAuthentication.authenticateAsync()` to enable; disable without auth), Analytics opt-in toggle
   - **Notifications**: On This Day notification toggle (requests permission inline if not granted, schedules/cancels notification)
   - **Storage**: "Photos Staged for Deletion: X" row → navigate to Trash; "Clear All Staged" (with confirmation)
   - **About**: App version, "Rate App" (StoreKit URL), "Privacy Policy" (WebBrowser)
   - All settings use `settingsStore` — reads/writes are immediate, persisted via MMKV
7. Wire Face ID toggle:
   - On enable: call `LocalAuthentication.authenticateAsync({ promptMessage: "Confirm your identity to enable Face ID lock" })`
   - On success: `settingsStore.setFaceIdEnabled(true)`
   - On failure/cancel: leave toggle off
8. Update `app/trash.tsx`: respect `settingsStore.faceIdEnabled` — only gate "Delete All" if enabled

#### Commits
1. `feat: On This Day screen — year timeline, section list, per-year review sessions`
2. `feat: daily On This Day local notification scheduling`
3. `feat: notification tap handler navigates to On This Day tab`
4. `feat: settings screen — all toggles wired to settingsStore`
5. `feat: Face ID enable/disable flow with live auth verification`

#### Manual Testing (device)
- On This Day tab shows grouped past photos (if any exist for today's date)
- Each year section has "Review [year]" CTA that starts a session with only that year's photos
- Check phone clock — notification fires at next 9 AM after scheduling
- Kill app, receive notification → tap → app opens on On This Day tab
- Toggle Face ID on in Settings → auth prompt appears → enabled
- Bulk delete in Trash: Face ID prompt fires before system dialog
- Toggle notifications off → notification cancelled (verify via Settings > Notifications)
- Change batch size → next Random session uses new count
- Settings persist after kill + reopen

---

### Day 6 — Full Glass UI Polish, Skia Effects, Micro-Interactions, Motion

#### Goal
Every screen looks and feels premium. BlurView, Skia shimmer, spring transitions, and haptics are applied consistently. The app is visually ready for the App Store.

#### Features
- Skia-powered gradient border + inner glow on `GlassCard`
- Dynamic blur background on review screen (blurred current photo)
- Tab bar custom glass style
- All press animations consistent (scale spring)
- Session entry transition (card zoom in from category card position)
- Session complete: Lottie confetti polished
- Swipe card spring constants tuned (feel, not placeholder values)
- All screens have consistent safe area handling
- Dark mode fully correct (all glass surfaces auto-adapt via `tint="systemMaterial"`)
- Loading skeletons everywhere (not spinners)

#### Step-by-Step Tasks

1. Update `src/components/glass/GlassCard.tsx`:
   - Overlay a `@shopify/react-native-skia` `Canvas` absolutely positioned on top
   - Draw: rounded rect gradient stroke (white→transparent, 1.5px) using `LinearGradient` fill on `RoundedRect`
   - Draw: inner glow (soft white `Paint` with blur mask, 8px, opacity 0.12)
   - The Skia canvas is pointer-events: none (it's decorative only)
2. Create `src/hooks/useSkiaGlass.ts`:
   - Returns Skia `Paint` configs for reuse across glass components
3. Update `app/review/[sessionId].tsx`:
   - Absolute-positioned full-screen blurred background: `expo-image` of current card's `uri` + `expo-blur` `BlurView` overlay at `intensity={100}`
   - Update background asset to next card with `withTiming` cross-fade as card exits
4. Update `app/(tabs)/_layout.tsx`:
   - Custom `tabBarBackground` using `BlurPanel` (frosted glass tab bar)
   - Tab bar: no border, no shadow — just blur + translucency
   - Active icon: white; inactive: `rgba(255,255,255,0.45)`
5. Global press animation: create `useSpringPress` hook (returns `animatedStyle` with scale 0.94 on press, 1 on release using `useAnimatedStyle` + `useSharedValue` + `withSpring`)
   - Apply to all `Pressable` wrappers: `CategoryCard`, `ActionButton`, glass buttons
6. Tune `SwipeCard` spring constants:
   - Snap-back: `{ damping: 20, stiffness: 280, mass: 0.8 }`
   - Fly-off: `{ damping: 14, stiffness: 120 }` (let it overshoot slightly for drama)
   - Stack promote: `{ damping: 18, stiffness: 200 }`
7. Tune `ActionOverlay`:
   - Add text label (`"DELETE"` / `"KEEP"` / `"FAVORITE"`) with `Animated.Text` scale that pumps at threshold
   - Label scale: `interpolate(|translateX|, [THRESHOLD*0.8, THRESHOLD], [0.8, 1.1])`
8. Create skeleton loading component (`SkeletonTile.tsx`):
   - Animated shimmer using Reanimated `withRepeat(withTiming(1, { duration: 1000 }), -1, true)` on a gradient overlay
   - Use in `SwipeStack` while next card is loading, `CategoryCard` while indexing
9. Add `SessionCompleteSheet` polish:
   - Lottie `confetti.json` plays at full width behind the sheet
   - Stats animate in with staggered `withDelay` sequence
   - MB savings number counts up with `withTiming`
10. Review screen header: animate in from top with `withSpring` on mount
11. Verify all screens handle iPhone notch/Dynamic Island safe area correctly (use `useSafeAreaInsets`)
12. Ensure all `expo-image` usage has `placeholder={{ blurhash: asset.blurHash }}` — add blurHash to `AssetMeta` type and populate from `MediaLibrary.getAssetInfoAsync`
13. On This Day screen: add parallax scroll effect on section thumbnails using `Animated.ScrollView`

#### Commits
1. `feat: Skia gradient border and inner glow on GlassCard`
2. `feat: blurred dynamic background in review session (current photo)`
3. `feat: glass tab bar, consistent press spring animations across all interactive elements`
4. `feat: SwipeCard spring constant tuning + ActionOverlay label pump animation`
5. `feat: skeleton loading shimmer component`
6. `feat: SessionCompleteSheet polish — Lottie confetti, staggered stats, MB counter`

#### Manual Testing (device)
- GlassCard shows subtle gradient border visible on both light and dark wallpapers
- Review screen background blurs and cross-fades as you swipe through cards
- Tab bar is genuinely frosted (background content visible through it)
- Every button press has a springy scale down+up feel
- Snap-back on partial swipe feels elastic, not stiff
- Fly-off swipe has slight overshoot (card gets lighter as it flies)
- DELETE/KEEP label pumps at the threshold cross
- Skeletons show while photos are loading (test on slow connection by throttling)
- Session complete Lottie plays immediately, stats count up with delay
- All screens: status bar content legible, no content behind Dynamic Island

---

### Day 7 — QA, Edge Cases, EAS Build, TestFlight

#### Goal
Bug-free, fully tested build submitted to TestFlight. All edge cases handled. App Store metadata prepared.

#### Features
- Full regression pass across all features
- Edge case handling: empty categories, very large libraries, no permissions
- App icon + splash screen
- EAS production build
- TestFlight submission
- `PLAN.md` committed to repo

#### Step-by-Step Tasks

1. **Edge cases to handle:**
   - Permission denied → show locked state on Home with re-request CTA
   - Limited photo access → show banner "You've granted access to [N] photos. Expand in Settings." with deep link
   - Category with 0 assets → CategoryCard disabled, shows "None" count, tapping shows empty state message
   - Swipe session with 1 card → session completes immediately after 1 swipe
   - Deletion of already-deleted asset → catch `deleteAssetsAsync` error, silently remove from staged
   - Library change (photo deleted externally) during active session → handle `onAssetRemoved` from MediaLibrary listener, skip that asset ID in deck
   - Very large libraries (100k+ photos) → ensure indexer chunking doesn't freeze; test with a heavy device
2. Handle `AppState` changes:
   - Foreground: re-check permissions, refresh On This Day notification
   - Background: flush any pending MMKV writes
3. Add `PLAN.md` to project root and commit:
   - Strip internal notes, keep the public-facing version of the plan
4. App icon:
   - Design or source a simple 1024×1024 icon (camera + swipe arrow motif)
   - Add to `assets/images/icon.png`
   - Configure `app.json`: `"icon": "./assets/images/icon.png"`
5. Splash screen:
   - Set `"splash": { "image": "./assets/images/splash.png", "backgroundColor": "#000000" }`
   - Create a dark splash with centered logo
6. `app.json` final checks:
   - `usageDescription` strings for all permissions (clear, non-technical language)
   - `infoPlist.NSPhotoLibraryUsageDescription`
   - `infoPlist.NSPhotoLibraryAddUsageDescription`
   - `infoPlist.NSFaceIDUsageDescription`
   - `userInterfaceStyle: "automatic"`
7. Run `eas build --platform ios --profile preview`:
   - Use "preview" EAS profile (ad-hoc distribution for TestFlight internal testing)
   - Fix any build errors
8. Submit to TestFlight: `eas submit --platform ios`
9. Final round of manual QA on TestFlight build (not Dev Client — test the real build)
10. Fix any issues found in TestFlight build, re-build if needed

#### Commits
1. `fix: edge case handling — empty categories, missing permissions, external library changes`
2. `chore: app icon, splash screen, permission usage descriptions`
3. `docs: add PLAN.md to project root`
4. `chore: eas.json production build profile, final app.json review`
5. `fix: [any bugs found in QA round]`

#### Manual Testing (device — TestFlight build)
- Install from TestFlight (not Dev Client)
- Full fresh-install flow: onboarding → permissions → home → all 7 sessions
- Delete photos → verify they appear in iOS Recently Deleted (Photos app)
- Restore from trash (app-level) → photo stays in library
- Kill app mid-session → reopen → staged items preserved, session resets cleanly
- Notifications: tomorrow at 9 AM (verify via notification center)
- Face ID: enable in settings, verify trash deletion requires auth
- Dark mode / light mode: all glass surfaces adapt correctly
- Test on at least 2 different iPhone models if possible

---

## Commit Strategy

**Naming convention:**
```
feat: add new user-facing functionality
fix: correct a bug or broken behavior
chore: config, tooling, dependencies, project setup
docs: documentation only
refactor: code restructure, no behavior change (rare — do this only when it's blocking)
```

**Rules:**
- Every commit leaves the app in a buildable, runnable state
- Commits are feature-scoped, not file-scoped ("feat: SwipeCard gesture" not "update SwipeCard.tsx")
- Never commit broken imports, TypeScript errors, or console.error calls
- Commit frequently (3–6 per day) — if a day's work is one commit, the tasks were too coarse
- Use present tense imperative ("add", "fix", "remove" — not "added", "fixed")

---

## Definition of MVP (End of Day 7)

The following must all work on a TestFlight build:

- [ ] Fresh install onboarding with photo permission request
- [ ] Home screen with 7 category cards showing real counts from device library
- [ ] Storage summary on Home screen
- [ ] All 7 session types launch with correct photos (Year, Month, On This Day, Screenshots, Videos, Favorites, Random)
- [ ] Swipe left = stage for deletion, swipe right = keep, swipe up = favorite
- [ ] Action buttons (✕ / ✓ / ★) work as tap alternatives to swipe
- [ ] Undo last swipe (pill, 3s auto-dismiss)
- [ ] Progress bar advances through session
- [ ] Double-tap card = full-screen preview with pinch-to-zoom
- [ ] Session complete sheet with Lottie confetti and stats
- [ ] Trash screen with grid of staged photos
- [ ] Per-item restore in Trash
- [ ] "Delete All" moves photos to iOS Recently Deleted (with Face ID + system confirm)
- [ ] On This Day tab: year-grouped timeline, per-year review sessions
- [ ] Daily 9 AM notification for On This Day
- [ ] Notification tap → navigate to On This Day tab
- [ ] Settings: batch size, Face ID toggle, notifications toggle, analytics opt-in
- [ ] Staged items persist across app kills (MMKV)
- [ ] Gallery index persists across app kills (MMKV)
- [ ] Glass UI on all screens (BlurView, translucent surfaces, no flat white panels)
- [ ] Spring animations on all swipe gestures (no linear, no instant)
- [ ] Haptics on every meaningful interaction
- [ ] Dark mode fully correct

---

## MUST-HAVE (integrated throughout — not added at the end)

### Glass UI
`GlassCard` and `BlurPanel` are built on **Day 1** and used from the first screen. Onboarding is glassy. Home is glassy. Every modal sheet is glassy. Never use a plain white `View` where a glass surface belongs.

### Smooth Gestures
Swipe deck is built with Reanimated worklets from **Day 3**. Gesture logic never touches the JS thread. Spring constants are tuned on Day 6 but the correct library (`react-native-reanimated` + `react-native-gesture-handler`) is installed and configured on **Day 1**.

### Micro-interactions
Haptics are wired from **Day 3** (swipe interactions) and **Day 2** (category card taps). Every interactive element has a press scale animation. These are never "TODO — add haptics later."

### Polished Animations
Lottie is installed on **Day 1**. The confetti JSON is sourced on **Day 4** (session complete). Session complete sheet has animated stat counters from **Day 4**. Full animation polish pass is **Day 6**, but animations are never placeholder.

---

## Summary

We are not simplifying the scope to hit 7 days — we are executing with focus and momentum. Each day ends with a device build that works. No orphaned code, no incomplete features left "to be wired later." The swipe gesture and the glass UI are the heart of the product and they are prioritized early (Day 1 for glass, Day 3 for swipe) so we have maximum time to tune them.

The lead engineer (AI) will guide each step: exact code to write, exact files to create, exact commands to run. Commits are reviewed before being made. We move fast, we ship clean.

---

## Notes for Implementation

- **`expo-media-library` deletion behavior:** `deleteAssetsAsync` triggers an iOS system confirmation dialog — this is intentional and required by Apple. Our trash screen provides the pre-confirmation; the system dialog is the final safety net. Do not attempt to suppress it.
- **Favorites smart album:** Use `MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })` then find the album named `"Favorites"` or with type `"smartAlbum"` on iOS. Fetch its assets with `getAssetsAsync({ album: favoritesAlbum })`.
- **No custom native modules:** Every required capability is covered by Expo SDK libraries. If we hit a gap, the fallback is to adjust the UX (e.g., skip a feature variant), not write native code.
- **Skia canvas on GlassCard:** The Skia canvas is absolutely positioned, `pointerEvents="none"`, purely decorative. It must never interfere with touch handling.
- **MMKV serialization:** `Set<string>` must be serialized as `JSON.stringify(Array.from(set))` and deserialized with `new Set(JSON.parse(str))`. Do this in a single utility function to avoid drift.
