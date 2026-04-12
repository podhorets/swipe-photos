# Architecture Rework — Simplified Session Flow

## Context

The app has accumulated complexity: global trash, favorite swipe, reviewedStore, deletionStore, pendingSummary/sessionFlowPending flags, and per-swipe MMKV writes that cause crashes during fast swiping. The user wants a clean rework:

- **Remove** favorite feature entirely (no up-swipe, no favorite category, no heart button)
- **Remove** global trash concept (no deletionStore, no trash icon on home, no trash in settings)
- **Remove** reviewedStore (replaced by simpler keepStore)
- **Session-local decisions only** — zero MMKV I/O during swiping
- **After session ends** → show trash screen with session's delete decisions
- **After trash** → selected items get iOS delete, deselected items saved as "kept" to MMKV
- **X button during session** → modal "Delete selected?" → yes → trash; no → discard & close
- **New sessions** filter out items in the keep array
- **No migration** — fresh device install assumed

---

## New Data Architecture

### keepStore (new) — `stores/keepStore.ts`
- Single MMKV key: `'keep:ids'` → JSON array of asset ID strings
- State: `{ keepIds: Set<string> }`
- Actions: `addMany(ids: string[])`, `has(id: string)`, `reset()`
- Load: `new Set(JSON.parse(storage.getString('keep:ids') ?? '[]'))`
- Save: `storage.set('keep:ids', JSON.stringify(Array.from(state.keepIds)))`
- Written ONLY at session end (after trash screen), never during swiping

### sessionStore (simplified) — `stores/sessionStore.ts`
- State: `{ session, currentIndex, decisions: Record<string, 'delete' | 'keep'>, undoStack }`
- Remove: `pendingSummary`, `sessionFlowPending`, `setPendingSummary`, `clearPendingSummary`, `setSessionFlowPending`
- `favoritedCount` references removed from SessionSummary type (type itself removed)

### Stores to DELETE
- `stores/deletionStore.ts` — entire file
- `stores/reviewedStore.ts` — entire file

### Type changes — `types/index.ts`
- `SwipeDecision`: `'delete' | 'keep'` (remove `'favorite'`)
- `SwipeDirection`: `'left' | 'right'` (remove `'up'`)
- `Category`: remove `'favorites'` from union
- Remove `DeletionResult` if unused elsewhere

---

## Step-by-step Implementation

### Step 1 — Create `keepStore`

**New file:** `stores/keepStore.ts`

```ts
// Zustand + Immer store, MMKV-persisted
// State: keepIds: Set<string>
// Actions: addMany(ids[]), has(id), reset()
// MMKV key: 'keep:ids'
```

**Modify:** `constants/config.ts`
- Add `keep: 'keep:ids'` to STORAGE_KEYS
- Remove `deletionStaged: 'deletion:staged'` and `reviewed: 'reviewed:decisions'`

Lint + typecheck + commit.
 
---

### Step 2 — Update types

**Modify:** `types/index.ts`
- `SwipeDecision = 'delete' | 'keep'` (remove `'favorite'`)
- `SwipeDirection = 'left' | 'right'` (remove `'up'`)
- `Category`: remove `'favorites'` from union
- Remove `DeletionResult` type if not referenced elsewhere

Lint + typecheck + commit (will have type errors in downstream files — fix in subsequent steps).
 
---

### Step 3 — Simplify `sessionStore`

**Modify:** `stores/sessionStore.ts`
- Remove `pendingSummary`, `sessionFlowPending` from state
- Remove `setPendingSummary`, `clearPendingSummary`, `setSessionFlowPending` actions
- Remove `SessionSummary` type
- `decisions` stays as `Record<string, SwipeDecision>` (now only 'delete' | 'keep')
- Keep: `session`, `currentIndex`, `decisions`, `undoStack`, `startSession`, `decide`, `undoLast`, `resetSession`

Lint + typecheck + commit.
 
---

### Step 4 — Delete `deletionStore` and `reviewedStore`

**Delete:** `stores/deletionStore.ts`
**Delete:** `stores/reviewedStore.ts`

These will cause import errors in:
- `hooks/useSession.ts`
- `components/swipe/SwipeStack.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/settings.tsx`
- `app/trash.tsx`

Fixed in subsequent steps.

Lint + typecheck + commit (or batch with step 5 if too many errors).
 
---

### Step 5 — Rework `useSession` hook

**Modify:** `hooks/useSession.ts`
- Remove imports: `deletionStore`, `reviewedStore`
- Add import: `keepStore`
- `startSession()`: use `keepStore.getState().keepIds` instead of `reviewedIds` to filter
- `swipeLeft(assetId)`: just `decideAction(assetId, 'delete')` + haptic (no MMKV write)
- `swipeRight(assetId)`: just `decideAction(assetId, 'keep')` + haptic (no MMKV write)
- Remove `swipeUp()` entirely
- `undoLast()`: just `undoLastAction()` + haptic (no unstage, no reviewedStore.remove)
- Remove `isComplete` from return (SwipeStack handles it)

Lint + typecheck + commit.
 
---

### Step 6 — Rework `SwipeStack`

**Modify:** `components/swipe/SwipeStack.tsx`
- Remove imports: `deletionStore`, `reviewedStore`, `Haptics`
- Remove store subscriptions: `stage`, `record`
- Keep: `session`, `currentIndex`, `decide` from sessionStore, `index` from galleryStore
- Swipe callbacks simplified:
    - `onSwipeLeft`: just `decide(assetId, 'delete')`
    - `onSwipeRight`: just `decide(assetId, 'keep')`
    - Remove `onSwipeUp` callback entirely
- Keep departing card logic (allRenderIds, stackIndex -1)
- Keep prefetch logic
- Keep auto-skip for externally-deleted assets

Lint + typecheck + commit.
 
---

### Step 7 — Rework `SwipeCard` (remove up-swipe)

**Modify:** `components/swipe/SwipeCard.tsx`
- Remove `onSwipeUp` prop
- Remove `swipedUp` detection in `onEnd` handler (the `e.translationY < -SWIPE.upThresholdPx` block)
- Keep left/right swipe with velocity threshold
- If snap-back: also reset Y (already done)

Lint + typecheck + commit.
 
---

### Step 8 — Rework `ActionOverlay` (remove favorite overlay)

**Modify:** `components/swipe/ActionOverlay.tsx`
- Remove the entire FAVORITE overlay section (the `translateY`-based interpolation and favorite icon/label)
- Keep DELETE (left) and KEEP (right) overlays
- Remove `translateY` prop if no longer needed (only used for favorite threshold)
- Actually, keep `translateY` prop since it's passed from SwipeCard (card still moves in Y during drag), but remove the favorite-specific interpolation

Lint + typecheck + commit.
 
---

### Step 9 — Remove favorite `ActionButton` from review screen

**Modify:** `components/ui/ActionButton.tsx`
- Remove `favorite` entry from CONFIG map
- Type: `type ActionButtonType = 'delete' | 'keep'`

**Modify:** `app/review/[sessionId].tsx`
- Remove `handleSwipeUp` function
- Remove `swipeUp` from `useSession()` destructure
- Remove the favorite `ActionButton` from the bottom bar
- Adjust layout: 2 buttons instead of 3 (delete + keep)

Lint + typecheck + commit.
 
---

### Step 10 — Rework review screen session completion flow

**Modify:** `app/review/[sessionId].tsx`

New `handleSessionComplete`:
```ts
const handleSessionComplete = useCallback(() => {
  const decisions = useSessionStore.getState().decisions;
  const deleteIds = Object.entries(decisions)
    .filter(([, d]) => d === 'delete')
    .map(([id]) => id);
 
  if (deleteIds.length > 0) {
    // Navigate to trash with session's delete decisions
    router.push('/trash');
  } else {
    // No deletions — save all as kept and show summary
    const allIds = Object.keys(decisions);
    useKeepStore.getState().addMany(allIds);
    setShowComplete(true);
  }
}, []);
```

Remove: `pendingSummary`, `sessionFlowPending` references

Add X button close handler:
```ts
const handleClose = useCallback(() => {
  const decisions = useSessionStore.getState().decisions;
  const hasDeletes = Object.values(decisions).some(d => d === 'delete');
 
  if (hasDeletes) {
    // Show confirmation modal
    Alert.alert(
      'Delete selected photos?',
      `You've marked ${Object.values(decisions).filter(d => d === 'delete').length} photos for deletion.`,
      [
        { text: 'Discard & Close', style: 'cancel', onPress: () => router.back() },
        { text: 'Review Trash', onPress: () => router.push('/trash') },
      ]
    );
  } else {
    // No deletes — save keeps and close
    const keepIds = Object.keys(decisions);
    if (keepIds.length > 0) useKeepStore.getState().addMany(keepIds);
    router.back();
  }
}, []);
```

Update the back/close `Pressable` to use `handleClose` instead of `router.back()`.

**SessionCompleteSheet** when `showComplete`:
- Pass only `totalCount`, `keptCount` (no `stagedCount`, no `favoritedCount`)
- `onDone={() => router.back()}`

Lint + typecheck + commit.
 
---

### Step 11 — Rework trash screen (session-scoped)

**Modify:** `app/trash.tsx`

Complete rework — trash is now session-scoped:
- Remove `deletionStore` import
- Import `useSessionStore` and `useKeepStore`
- Data source: `useSessionStore.getState().decisions` — show only items where decision === 'delete'
- All items pre-selected for deletion (same as current)
- User can deselect items (deselected = saved as kept)
- On "Delete" button press:
    1. Face ID gate (if enabled)
    2. `MediaLibrary.deleteAssetsAsync(selectedIds)` — iOS system confirmation
    3. After confirmation:
        - Selected (deleted) IDs: `galleryStore.removeAssets(selectedIds)`
        - Deselected IDs + all 'keep' decisions from session: `keepStore.addMany(allKeptIds)`
        - Show inline summary (completion stats)
        - Navigate back (or show SessionCompleteSheet inline)
- Remove `sessionFlowPending` logic
- Remove `pendingSummary` logic

The flow: session ends → navigate to trash → user confirms → iOS deletes → kept IDs saved → summary shown → back to home.

Lint + typecheck + commit.
 
---

### Step 12 — Rework `SessionCompleteSheet`

**Modify:** `components/ui/SessionCompleteSheet.tsx`
- Remove `favoritedCount` prop
- Remove `showReviewTrash` and `onReviewTrash` props (trash is already handled before this sheet shows)
- Stats: only "Deleted" and "Kept" (2 stat items instead of 3)
- Props: `totalCount`, `deletedCount`, `keptCount`, `onDone`

Lint + typecheck + commit.
 
---

### Step 13 — Rework home screen

**Modify:** `app/(tabs)/index.tsx`
- Remove imports: `deletionStore`, `reviewedStore`, `SessionCompleteSheet`, `useSessionStore`
- Add import: `useKeepStore`
- Remove: trash icon/badge in header
- Remove: `pendingSummary` subscription and modal rendering
- Progress calculation: use `keepStore.keepIds` instead of `reviewedStore.decisions`
  ```ts
  const keepIds = useKeepStore((s) => s.keepIds);
  // progress = items in keepIds that belong to this category / total in category
  ```
- Remove: Favorites category card entirely
- Keep: year, month, on-this-day, screenshots, videos, random categories

Lint + typecheck + commit.
 
---

### Step 14 — Rework settings screen

**Modify:** `app/(tabs)/settings.tsx`
- Remove: "Storage" section showing staged deletion count and "Clear Staged" button
- Remove: `deletionStore` import
- Keep: batch size, Face ID, notifications, analytics, about

Lint + typecheck + commit.
 
---

### Step 15 — Update `sessionFactory`

**Modify:** `lib/session/sessionFactory.ts`
- Rename parameter `reviewedIds` → `keepIds` (Set<string>)
- Remove `'favorites'` case from switch
- Filter logic: `assets.filter(a => !keepIds.has(a.id))` (same filter, different name)
- All categories still get batched sessions

Lint + typecheck + commit.
 
---

### Step 16 — Update `galleryStore` and indexer

**Modify:** `stores/galleryStore.ts`
- Remove `favoriteIds` from state
- Remove `setFavoriteIds` action

**Modify:** `hooks/useGalleryIndex.ts`
- Remove favorite album fetching logic
- Remove `setFavoriteIds` calls

**Modify:** `lib/gallery/grouper.ts`
- Remove `getFavorites()` function

**Modify:** `lib/gallery/indexer.ts`
- Remove favorite-related code if it fetches favorites separately

**Modify:** `constants/config.ts`
- Remove `favoriteIds` from STORAGE_KEYS

Lint + typecheck + commit.
 
---

### Step 17 — Update theme constants

**Modify:** `constants/theme.ts`
- Remove `SWIPE.upThresholdPx`
- Remove `COLORS.favorite` object
- Keep `COLORS.delete` and `COLORS.keep`

**Modify:** `tailwind.config.js`
- Remove `favorite` color if defined there

Lint + typecheck + commit.
 
---

### Step 18 — Update root layout

**Modify:** `app/_layout.tsx`
- Verify trash route is still registered as modal (it stays, but now session-scoped)
- Remove any `enableMapSet()` call if no more Sets in Immer stores... actually keepStore uses Set, so keep it
- Clean up any dead imports

Lint + typecheck + commit.
 
---

### Step 19 — Update onboarding

**Modify:** `app/onboarding.tsx`
- Remove any mention of favorites in onboarding flow/text
- Update swipe instructions: only left (delete) and right (keep)

Lint + typecheck + commit.
 
---

### Step 20 — Final cleanup and verification

- Run `npm run lint` — zero errors
- Run `npm run typecheck` — zero errors
- Search for any remaining references to: `deletionStore`, `reviewedStore`, `favorite`, `swipeUp`, `pendingSummary`, `sessionFlowPending`
- Verify all dead imports are removed

---

## Critical Files Summary

| Action | File |
|--------|------|
| CREATE | `stores/keepStore.ts` |
| DELETE | `stores/deletionStore.ts` |
| DELETE | `stores/reviewedStore.ts` |
| MODIFY | `types/index.ts` |
| MODIFY | `constants/config.ts` |
| MODIFY | `constants/theme.ts` |
| MODIFY | `tailwind.config.js` |
| MODIFY | `stores/sessionStore.ts` |
| MODIFY | `stores/galleryStore.ts` |
| MODIFY | `hooks/useSession.ts` |
| MODIFY | `hooks/useGalleryIndex.ts` |
| MODIFY | `lib/session/sessionFactory.ts` |
| MODIFY | `lib/gallery/grouper.ts` |
| MODIFY | `lib/gallery/indexer.ts` |
| MODIFY | `components/swipe/SwipeStack.tsx` |
| MODIFY | `components/swipe/SwipeCard.tsx` |
| MODIFY | `components/swipe/ActionOverlay.tsx` |
| MODIFY | `components/ui/ActionButton.tsx` |
| MODIFY | `components/ui/CategoryCard.tsx` |
| MODIFY | `components/ui/SessionCompleteSheet.tsx` |
| MODIFY | `app/review/[sessionId].tsx` |
| MODIFY | `app/trash.tsx` |
| MODIFY | `app/(tabs)/index.tsx` |
| MODIFY | `app/(tabs)/settings.tsx` |
| MODIFY | `app/_layout.tsx` |
| MODIFY | `app/onboarding.tsx` |
 
---

## Verification Plan

1. **Fresh start**: Kill app, reopen. Home shows categories without favorites, no trash icon.
2. **Start session**: Pick Screenshots. Only 2 buttons (delete/keep). No up-swipe gesture. Swipe a few cards — app stays responsive (no MMKV writes).
3. **Complete session with deletes**: Swipe all cards. App navigates to trash showing only delete-marked photos. Deselect one. Press Delete. iOS confirmation dialog appears. After confirm: deselected item saved to keepStore, deleted items removed from gallery. Summary shown. Navigate back to home.
4. **Complete session without deletes**: Keep all photos. Summary shows immediately (no trash redirect). All IDs saved to keepStore.
5. **Progress persistence**: Restart app. Category shows progress bar reflecting kept count.
6. **Re-enter category**: Start same category again — previously kept photos don't appear.
7. **X button mid-session**: Swipe a few cards (some delete, some keep). Press X. Modal appears with "Delete selected?" options. Test both paths (discard vs review trash).
8. **Fast swiping**: Swipe 20+ cards rapidly — no crash, no spinner, no lag.
9. **Quality gates**: `npm run lint` and `npm run typecheck` both pass clean.