# PLAN.md — Swipe Photos: 4-Feature Implementation Plan

## Context

The Swipe Photos app lets users review their photo library by swiping cards left (delete), right (keep), or up (favorite). Currently, only "Random Review" uses batched sessions (N photos at a time), while other categories dump all matching photos into one giant session. Keep/favorite decisions are not persisted, so photos reappear across sessions. There is also a visual flash during swipes (key-collision issue), the swipe threshold feels too high, and the post-session modal flow has a stale-state bug and a suboptimal UX.
 
---

## Topic 1 — Session-based progress for all groups

### Current state

- **Session creation**: `lib/session/sessionFactory.ts:createSession()` builds a `Session { id, category, label, assetIds, createdAt }`. Only `'random'` is batched via `getRandom(index, batchSize)`. All other categories load every matching asset (e.g. all screenshots, all photos from 2023).
- **Batch size setting**: `stores/settingsStore.ts` — `batchSize` (default 50), persisted in MMKV key `'settings'`. Options: 25/50/100 in Settings UI.
- **Decision persistence**: `stores/sessionStore.ts` keeps `decisions: Record<string, SwipeDecision>` in memory only. `'delete'` decisions are also staged to `stores/deletionStore.ts` (`staged: Set<string>`, MMKV key `'deletion:staged'`). `'keep'` and `'favorite'` decisions vanish when the session ends.
- **Category card**: `components/ui/CategoryCard.tsx` — props `{ id, label, icon, count, subtitle?, disabled?, loading?, onPress }`. No progress bar or percentage. Count badge shows total items.
- **Home screen**: `app/(tabs)/index.tsx` computes counts via grouper functions in a `useMemo`. No reviewed-count calculation exists.

### Analysis

- There is no persistent record of keep/favorite decisions, so photos that were already reviewed reappear in future sessions.
- A new MMKV-persisted store is needed to track which photos have been reviewed and what the decision was.
- `createSession()` must accept a set of reviewed IDs and exclude them from the candidate pool, then apply `batchSize` slicing to all categories (not just random).
- Progress = `reviewedCount / totalInCategory`. The "total" is the count of photos matching a category filter. The "reviewed" count is how many of those have a persisted decision.
- CategoryCard needs a progress bar; the home screen must compute and pass progress per category.

### Step-by-step tasks

**Step 1.1 — Add MMKV storage key for reviewed decisions**

File: `constants/config.ts`

Add `reviewed: 'reviewed:decisions'` to `STORAGE_KEYS`.

No behavior change. Lint + typecheck + commit.
 
---

**Step 1.2 — Create `reviewedStore.ts`**

New file: `stores/reviewedStore.ts`

Pattern: identical to `deletionStore.ts` — module-level `createMMKV()`, load/save helpers, Zustand + Immer store.

```ts
interface ReviewedState {
  decisions: Map<string, SwipeDecision>;  // assetId -> 'keep' | 'delete' | 'favorite'
  record: (assetId: string, decision: SwipeDecision) => void;
  remove: (assetId: string) => void;  // for undo
  reset: () => void;  // full wipe (settings / debug)
}
```

Persistence: `JSON.stringify(Array.from(decisions.entries()))` / `new Map(JSON.parse(...))`.

Note: MMKV cannot store `Map` natively — serialize as array of `[key, value]` tuples per CLAUDE.md pattern.

Note: `enableMapSet()` is already called in `app/_layout.tsx`, so Immer can mutate Maps.

No callers yet. Lint + typecheck + commit.
 
---

**Step 1.3 — Wire `reviewedStore` into `useSession` hook**

File: `hooks/useSession.ts`

- In `swipeLeft()`, `swipeRight()`, `swipeUp()`: after `store.decide(...)`, add `useReviewedStore.getState().record(assetId, decision)`.
- In `undoLast()`: after the existing undo logic, add `useReviewedStore.getState().remove(restoredId)`.

Every swipe now persists the decision to MMKV. Undo removes it. Session creation not yet changed — photos may still reappear (next step fixes that).

Lint + typecheck + commit.
 
---

**Step 1.4 — Make `createSession()` exclude reviewed photos and batch all categories**

File: `lib/session/sessionFactory.ts`

- Add parameter `reviewedIds: Set<string>` to `createSession()`.
- After building `assets` in each switch case, filter: `assets = assets.filter(a => !reviewedIds.has(a.id))`.
- For ALL categories (including year, month, screenshots, etc.), apply: `assets = assets.slice(0, batchSize)` after filtering. This gives every group N-photo batched sessions.
- For `'random'`: filter before shuffle/slice (already correct since `getRandom` shuffles then slices).

File: `hooks/useSession.ts`

- Update `startSession()` to pass reviewed IDs:
  ```ts
  const reviewedIds = new Set(useReviewedStore.getState().decisions.keys());
  const session = createSession(request, index, favoriteIds, reviewedIds);
  ```

Now all groups get batched sessions that skip already-reviewed photos. Unlimited sessions until 100% reviewed.

Lint + typecheck + commit.
 
---

**Step 1.5 — Add progress bar to `CategoryCard`**

File: `components/ui/CategoryCard.tsx`

- Add optional props: `progress?: number` (0–1), `isComplete?: boolean`.
- When `progress !== undefined && progress > 0`: render a thin progress bar below the subtitle. Use a simple `View` with computed width `${Math.round(progress * 100)}%` and a green background (`COLORS.keep.solid`). Wrap in a container with `bg-white/10 rounded-full h-1.5 mt-2`.
- Show percentage text: `${Math.round(progress * 100)}%` next to the count badge.
- When `isComplete`: replace count badge with a checkmark icon in a green circle and text "Done".

No caller passes these props yet. Existing behavior unchanged.

Lint + typecheck + commit.
 
---

**Step 1.6 — Compute and pass progress from Home screen**

File: `app/(tabs)/index.tsx`

- Import `useReviewedStore`.
- Subscribe to `decisions` map: `const reviewedDecisions = useReviewedStore((s) => s.decisions);`
- In the existing `counts` useMemo (or a new one), compute per-category progress:
  ```ts
  const progress = useMemo(() => {
    const reviewedIds = new Set(reviewedDecisions.keys());
    // For each category, get total assets via grouper, then count how many are in reviewedIds
    const screenshotsAll = getScreenshots(index);
    const videosAll = getVideos(index);
    const favoritesAll = getFavorites(index, favoriteIds);
    const onThisDayAll = getOnThisDay(index);
    return {
      screenshots: screenshotsAll.length > 0 ? screenshotsAll.filter(a => reviewedIds.has(a.id)).length / screenshotsAll.length : 0,
      videos: videosAll.length > 0 ? videosAll.filter(a => reviewedIds.has(a.id)).length / videosAll.length : 0,
      favorites: favoritesAll.length > 0 ? favoritesAll.filter(a => reviewedIds.has(a.id)).length / favoritesAll.length : 0,
      onThisDay: onThisDayAll.length > 0 ? onThisDayAll.filter(a => reviewedIds.has(a.id)).length / onThisDayAll.length : 0,
      year: 0,  // year/month progress is per-subcategory, not shown on card
      month: 0,
      random: 0,  // random is infinite, no progress
    };
  }, [index, favoriteIds, reviewedDecisions]);
  ```
- Pass `progress={progress[cat.id]}` and `isComplete={progress[cat.id] >= 1}` to each `CategoryCard`.
- For `year`/`month`/`random`: don't pass progress (they are sub-grouped or infinite).

Home screen now shows live progress bars. Progress survives restarts.

Lint + typecheck + commit.

### Definition of done

- All groups use batched sessions of `batchSize` photos
- Keep/favorite decisions are persisted in MMKV and survive restarts
- Already-reviewed photos never appear in new sessions
- CategoryCard shows a progress bar and percentage for screenshots, videos, favorites, on-this-day
- Progress reaches 100% when all photos in a category are reviewed
- Starting a new session after 100% shows an empty-session state (no photos to review)

---

## Topic 2 — Fix the flash / broken sequence during card swipe

### Current state

- **SwipeStack** (`components/swipe/SwipeStack.tsx`): renders 3 visible cards via `visibleAssetIds = session.assetIds.slice(currentIndex, currentIndex + 3)`, reversed for back-to-front rendering.
- **Key assignment** (line 97): `key={`${absoluteIndex}-${assetId}`}` where `absoluteIndex = currentIndex + stackIndex`.
- **State update timing**: `decide()` is called immediately via `scheduleOnRN(onSwipeLeft)` in `SwipeCard.tsx:81`. This increments `currentIndex` synchronously. The fly-off spring animation (`withSpring(-SCREEN_WIDTH * 1.5, SPRING.flyOff)`) runs in parallel on the UI thread.
- **SwipeCard** (`components/swipe/SwipeCard.tsx`): `translateX`, `translateY` are local `useSharedValue`s. Fly-off animation values are local to the component instance. `stackIndex` changes trigger spring animations for scale/offsetY/opacity via `useEffect` (line 53-57).

### Analysis

**Root cause**: When `decide()` fires, `currentIndex` increments immediately. On the next React render:
1. `visibleAssetIds` recomputes — the departing card is no longer in the slice.
2. The `absoluteIndex` for the remaining cards changes (e.g., card at position 1 was `key="1-abc"`, now it's `key="2-abc"`).
3. React sees changed keys → unmounts the old component instances (killing in-flight `translateX` animation) → mounts new instances (which start at `translateX=0`).
4. The departing card's fly-off animation is destroyed mid-flight → a fresh card appears at position 0 with `translateX=0` → **flash**.

**Fix strategy**: Two changes needed:
1. Use `key={assetId}` so React preserves component identity across `currentIndex` changes.
2. Keep the departing card in the render tree until its fly-off animation completes. Track departing IDs in a ref, include them in the render list, and clean them up after the animation duration.

### Step-by-step tasks

**Step 2.1 — Fix swipe card keys and keep departing cards in render tree**

File: `components/swipe/SwipeStack.tsx`

1. Change key from `key={`${absoluteIndex}-${assetId}`}` to `key={assetId}`.

2. Add a departing-card tracking mechanism:
   ```ts
   const [departingIds, setDepartingIds] = useState<string[]>([]);
   ```

3. In the swipe callbacks (`onSwipeLeft`, `onSwipeRight`, `onSwipeUp`), add the assetId to `departingIds` BEFORE calling `decide()`:
   ```ts
   onSwipeLeft={() => {
     setDepartingIds(prev => [...prev, assetId]);
     decide(assetId, 'delete');
     stage(assetId);
     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
   }}
   ```

4. Schedule cleanup of departing IDs after 500ms (fly-off spring duration):
   ```ts
   useEffect(() => {
     if (departingIds.length === 0) return;
     const timer = setTimeout(() => {
       setDepartingIds([]);
     }, 500);
     return () => clearTimeout(timer);
   }, [departingIds]);
   ```

5. Build the render list to include departing cards:
   ```ts
   const allRenderIds = [
     ...departingIds.filter(id => !visibleAssetIds.includes(id)),
     ...visibleAssetIds,
   ];
   const renderIds = [...allRenderIds].reverse();
   ```

6. When rendering, departing cards get `stackIndex={-1}`:
   ```ts
   const isDeparting = departingIds.includes(assetId);
   const stackIndex = isDeparting ? -1 : visibleAssetIds.indexOf(assetId);
   ```

File: `components/swipe/SwipeCard.tsx`

7. Handle `stackIndex === -1` (departing card):
    - Skip the `useEffect` that animates stack position (guard: `if (stackIndex < 0) return`).
    - Set `pointerEvents="none"` on the Animated.View when departing.
    - Do NOT reset `translateX`/`translateY` — they retain the fly-off values.

8. Handle undo: if `currentIndex` decreases, remove the restored assetId from `departingIds`:
   ```ts
   const prevIndex = useRef(currentIndex);
   useEffect(() => {
     if (currentIndex < prevIndex.current) {
       // Undo occurred — remove any departing ID that's back in visible range
       setDepartingIds(prev => prev.filter(id => !visibleAssetIds.includes(id)));
     }
     prevIndex.current = currentIndex;
   }, [currentIndex, visibleAssetIds]);
   ```

Lint + typecheck + commit.

### Definition of done

- Swiping a card shows a smooth fly-off animation; the next card is already visible behind with no flash
- Rapid swiping (3+ cards quickly) works without visual glitches
- Undo after swipe works correctly — card reappears at the top of the stack
- No key-related React warnings in dev console

---

## Topic 3 — Reduce swipe threshold for faster, more natural swiping

### Current state

- **Threshold constant**: `constants/theme.ts:90-93` — `SWIPE.threshold = 0.35`, `SWIPE.thresholdPx = SCREEN_WIDTH * 0.35`.
- **Usage in SwipeCard**: `components/swipe/SwipeCard.tsx:74-78` — `e.translationX < -SWIPE.thresholdPx` (left), `> SWIPE.thresholdPx` (right).
- **Up threshold**: `SWIPE.upThresholdPx = 100` (pixels, not screen-relative).
- **No velocity-based trigger exists** — only distance is checked.
- **Haptic feedback threshold**: uses the same `SWIPE.thresholdPx` in `onUpdate` (line 65).

### Analysis

35% screen width (~140px on iPhone 15 Pro) requires a long drag. 25% (~100px) is more natural. Adding a velocity trigger allows fast flicks to complete at even less distance, making the app feel snappier without increasing accidental swipes (slow drags still require the full 25% threshold).

### Step-by-step tasks

**Step 3.1 — Lower distance threshold and add velocity trigger**

File: `constants/theme.ts`

```ts
// Change:
threshold: 0.35,
thresholdPx: SCREEN_WIDTH * 0.35,
// To:
threshold: 0.25,
thresholdPx: SCREEN_WIDTH * 0.25,
// Add:
velocityThresholdX: 800,  // px/s — fast flick completes at half the distance
```

File: `components/swipe/SwipeCard.tsx`

Update `onEnd` handler (lines 73-78):
```ts
const swipedLeft =
  e.translationX < -SWIPE.thresholdPx ||
  (e.translationX < -SWIPE.thresholdPx * 0.5 && e.velocityX < -SWIPE.velocityThresholdX);
const swipedRight =
  e.translationX > SWIPE.thresholdPx ||
  (e.translationX > SWIPE.thresholdPx * 0.5 && e.velocityX > SWIPE.velocityThresholdX);
```

Logic: full swipe at 25% width OR fast flick (>800 px/s) at just 12.5% width.

The `onUpdate` haptic threshold (line 65) already uses `SWIPE.thresholdPx`, so it automatically adjusts.

Lint + typecheck + commit.

### Definition of done

- Swipes trigger at ~25% screen width (distance-only) or ~12.5% width with a fast flick
- Both left and right swipes use the same threshold
- Up swipe threshold (`upThresholdPx: 100`) is unchanged
- Haptic feedback fires at the correct (lower) threshold
- No accidental swipes from normal scrolling/tapping — swipe still requires intentional horizontal drag

---

## Topic 4 — Post-session flow: direct trash redirect + modal bug fix

### Current state

- **Session complete detection**: `SwipeStack.tsx:29,51-53` — `isComplete = totalCount > 0 && currentIndex >= totalCount` triggers `useEffect` → `onSessionComplete()`.
- **Modal state**: `app/review/[sessionId].tsx:47` — `const [showComplete, setShowComplete] = useState(false)`. Set to `true` in `handleSessionComplete` callback (line 106-108).
- **SessionCompleteSheet**: `components/ui/SessionCompleteSheet.tsx` — shows "All Done!", stats, "Review Trash" button (if `stagedCount > 0`), and "Done" button.
- **Trash navigation**: `onReviewTrash` → `router.back(); router.push('/trash')` (line 204-206).
- **Trash screen**: `app/trash.tsx` — shows staged photos, deletion flow, auto-navigates back when `staged.size - ids.length <= 0` (line 160-162).
- **Session start guard**: `didStart` ref (line 62) prevents double-start. Only set once — never reset for param changes.
- **`resetSession()` is never called** — `startSession()` resets implicitly.

### Analysis

**Stale-state bug**: Expo Router can reuse a mounted screen component when navigating to the same route with different params. If the user completes session A (`showComplete = true`), presses "Done" (`router.back()`), then starts session B (same route `/review/[sessionId]`), the component may not remount. `showComplete` stays `true`, and `didStart.current` stays `true` (preventing the new session from starting). The new session shows the "All Done!" modal immediately.

**Fix**: Key session state on the search params. When `sessionId`/`year`/`month` change, reset `showComplete` and re-trigger `startSession()`.

**Flow redesign**: After the last swipe, if there are staged deletions, navigate directly to trash. After trash confirms deletion, show the summary modal on the home screen (since the review screen is already dismissed). If no deletions were staged, show the summary modal immediately on the review screen.

### Step-by-step tasks

**Step 4.1 — Fix stale-state bug on session re-entry**

File: `app/review/[sessionId].tsx`

Replace the `didStart` ref pattern (lines 62-71) with a param-keyed approach:

```ts
const sessionKey = `${sessionId}-${year ?? ''}-${month ?? ''}`;
const lastStartedKey = useRef('');
 
useEffect(() => {
  if (lastStartedKey.current === sessionKey) return;
  lastStartedKey.current = sessionKey;
  setShowComplete(false);
  startSession({
    category: sessionId as Category,
    yearFilter: year ? Number(year) : undefined,
    monthFilter: month,
  });
}, [sessionKey]);
```

Remove the old `didStart` ref.

This ensures: same params = no re-start (idempotent), different params = fresh session + reset modal state.

Lint + typecheck + commit.
 
---

**Step 4.2 — Add `pendingSummary` to sessionStore**

File: `stores/sessionStore.ts`

Add to state:
```ts
pendingSummary: {
  totalCount: number;
  stagedCount: number;
  keptCount: number;
  favoritedCount: number;
} | null;
```

Add actions:
```ts
setPendingSummary: (summary) => set((state) => { state.pendingSummary = summary; }),
clearPendingSummary: () => set((state) => { state.pendingSummary = null; }),
```

Initialize as `null`. In `resetSession()`, also set `pendingSummary = null`.

Lint + typecheck + commit.
 
---

**Step 4.3 — Make `SessionCompleteSheet` trash button optional**

File: `components/ui/SessionCompleteSheet.tsx`

Add optional prop `showReviewTrash?: boolean` (default `true`).

When `false`: hide the "Review Trash" `Pressable` entirely. Change "Done" text to always say "Back to Home".

No behavioral change to existing callers (they don't pass the prop, so default `true` preserves current behavior).

Lint + typecheck + commit.
 
---

**Step 4.4 — Change post-session flow in ReviewScreen**

File: `app/review/[sessionId].tsx`

Update `handleSessionComplete`:
```ts
const handleSessionComplete = useCallback(() => {
  const currentDecisions = useSessionStore.getState().decisions;
  const staged = Object.values(currentDecisions).filter(d => d === 'delete').length;
  const kept = Object.values(currentDecisions).filter(d => d === 'keep').length;
  const favorited = Object.values(currentDecisions).filter(d => d === 'favorite').length;
  const total = Object.keys(currentDecisions).length;
 
  if (staged > 0) {
    // Save summary for Home screen to show after trash flow
    useSessionStore.getState().setPendingSummary({
      totalCount: total,
      stagedCount: staged,
      keptCount: kept,
      favoritedCount: favorited,
    });
    // Navigate directly to trash, replacing review in stack
    router.dismiss();
    router.push('/trash');
  } else {
    // No deletions — show summary immediately
    setShowComplete(true);
  }
}, []);
```

When `showComplete` renders `SessionCompleteSheet`, pass `showReviewTrash={false}` since the trash redirect already happened (or there were no deletions):
```tsx
{showComplete && (
  <SessionCompleteSheet
    ...
    showReviewTrash={false}
    onReviewTrash={() => {}}
    onDone={() => router.back()}
  />
)}
```

Lint + typecheck + commit.
 
---

**Step 4.5 — Show summary modal on Home screen after trash completion**

File: `app/(tabs)/index.tsx`

- Import `useSessionStore`, `SessionCompleteSheet`.
- Subscribe to `pendingSummary`:
  ```ts
  const pendingSummary = useSessionStore((s) => s.pendingSummary);
  const clearPendingSummary = useSessionStore((s) => s.clearPendingSummary);
  ```
- At the bottom of the JSX (after `MonthPicker`), conditionally render:
  ```tsx
  {pendingSummary && (
    <SessionCompleteSheet
      totalCount={pendingSummary.totalCount}
      stagedCount={pendingSummary.stagedCount}
      keptCount={pendingSummary.keptCount}
      favoritedCount={pendingSummary.favoritedCount}
      showReviewTrash={false}
      onReviewTrash={() => {}}
      onDone={clearPendingSummary}
    />
  )}
  ```

The flow becomes: last swipe → trash screen → user confirms deletion → trash auto-navigates back to home → home detects `pendingSummary` → shows "All Done!" modal with summary → user presses OK → modal dismissed.

Lint + typecheck + commit.

### Definition of done

- Stale-state bug is fixed: starting a new session with different params always resets properly
- After the last swipe with deletions: app navigates directly to trash (no modal first)
- After trash deletion is confirmed and user returns to home: "All Done!" modal shows with accurate stats
- After the last swipe with zero deletions: "All Done!" modal shows immediately on the review screen
- "All Done!" modal never appears unless the user just completed a session or trash review
- The "Review Trash" button is hidden on the post-trash summary modal (since trash was already reviewed)

---

## Verification plan

After all 4 topics are implemented:

1. **Progress persistence**: Start a Screenshots session, swipe 10 photos, exit. Restart the app. Verify the CategoryCard shows ~correct progress. Start another session — verify those 10 photos don't reappear.

2. **No flash**: Start any session, swipe rapidly through 5+ cards. Verify zero visual flash or flicker between cards. Verify undo works correctly after swipe.

3. **Swipe threshold**: Start a session, verify that a shorter horizontal drag (~25% screen width) triggers a swipe. Verify fast flicks complete with even less distance. Verify accidental touches don't trigger swipes.

4. **Post-session flow**: Complete a session by swiping all cards. If any were marked for deletion, verify immediate navigation to trash. Confirm deletion, verify "All Done!" modal appears on home with correct stats. Then start a new session — verify no stale modal appears.

5. **Quality gates**: Run `npm run lint` and `npm run typecheck` — both must pass with zero errors/warnings.