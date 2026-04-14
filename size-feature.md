# Plan: Show Storage Freed

## Context

The app currently has no feedback about how much storage a user is reclaiming by deleting photos. Adding real file-size display at three points (per-card overlay, session summary, lifetime total) gives users a tangible sense of progress.

## Asset size loading — analysis & decision

`expo-media-library` `Asset` objects do NOT include `fileSize`. To get real sizes:

1. `MediaLibrary.getAssetInfoAsync(assetId)` → returns `localUri` (a `file://` path)
2. `new File(localUri).size` from `expo-file-system` → exact bytes (**synchronous** property)

For iCloud-only assets where `localUri` is `undefined`, fall back to estimates (`AVG_PHOTO_SIZE_BYTES` / `AVG_VIDEO_SIZE_BYTES`).

### Options evaluated

| Option | Approach | Verdict |
|--------|----------|---------|
| **A — Prefetch all at session start** | Fire `getAssetInfoAsync` for all ~50 session assets in parallel right after session starts. Store sizes in a Map. | **Selected** |
| B — On demand per card | Call `getAssetInfoAsync` as each card renders. | Rejected: visible loading delay on each card, size might not be ready when overlay shows |
| C — Hybrid prefetch-ahead | Prefetch N ahead of current index, lazy-load rest. | Rejected: unnecessary complexity for ≤50 assets |
| D — Background thread | Offload to worklet/native thread. | Rejected: `getAssetInfoAsync` already runs on native thread; JS thread only receives the result |

### Why Option A

- Sessions are small (≤50 assets, configurable `batchSize`)
- `getAssetInfoAsync` is a fast native metadata lookup (no file I/O, no network)
- 50 parallel calls complete in <1 second on modern iPhones
- By the time user processes the first card, all sizes are ready
- Non-blocking: session starts immediately, sizes populate in background
- Estimate fallback covers the race window (first card before sizes arrive) and iCloud assets
- `expo-file-system` is already installed as a bundled Expo SDK module — no new dependency, no native rebuild needed. Just needs explicit `npx expo install expo-file-system` to add to `package.json`.

## Files to modify/create

| # | File | Action | Purpose |
|---|------|--------|---------|
| 0 | `package.json` | modify | Add `expo-file-system` as explicit dependency |
| 1 | `constants/config.ts` | modify | Add `statsFreedBytes` MMKV key |
| 2 | `lib/sizeUtils.ts` | **create** | `fetchAssetSizes()` + `getEstimatedSize()` helpers |
| 3 | `stores/statsStore.ts` | **create** | Lifetime freed bytes (MMKV-persisted) |
| 4 | `stores/sessionStore.ts` | modify | Add `sizeSnapshot` Map + `mediaTypeSnapshot` Map |
| 5 | `hooks/useSession.ts` | modify | Build `mediaTypeSnapshot`, kick off async size prefetch |
| 6 | `components/swipe/ActionOverlay.tsx` | modify | Show `~4.0 MB` on delete overlay |
| 7 | `components/swipe/SwipeCard.tsx` | modify | Forward `estimatedSize` prop |
| 8 | `components/swipe/SwipeStack.tsx` | modify | Look up real size (fallback to estimate), pass to card |
| 9 | `components/ui/SessionCompleteSheet.tsx` | modify | Add optional `freedBytes` stat |
| 10 | `app/trash.tsx` | modify | Compute freed from real sizes, persist lifetime, pass to sheet |
| 11 | `app/review/[sessionId].tsx` | modify | Pass `freedBytes={0}` to sheet |
| 12 | `components/ui/StorageSummary.tsx` | modify | Show lifetime freed row |

## Detailed changes

### 0. Add `expo-file-system` to package.json

Run `npx expo install expo-file-system`. It's already in `node_modules` as a transitive Expo SDK module — this just makes the import explicit. No native rebuild needed.

### 1. `constants/config.ts` — add MMKV key

Add `statsFreedBytes: 'stats:freedBytes'` to `STORAGE_KEYS`.

### 2. `lib/sizeUtils.ts` — new file

Two exports:

```ts
getEstimatedSize(mediaType: string): number
```
Returns `AVG_VIDEO_SIZE_BYTES` for video, `AVG_PHOTO_SIZE_BYTES` otherwise. Used as fallback.

```ts
fetchAssetSizes(assetIds: string[]): Promise<Map<string, number>>
```
- Calls `MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: false })` for each asset in parallel
- For each result with `localUri`, reads `new File(localUri).size` (synchronous)
- For iCloud assets (`localUri` undefined / `isNetworkAsset: true`), skips (caller falls back to estimate)
- Returns `Map<assetId, sizeInBytes>`

### 3. `stores/statsStore.ts` — new store

Follows `streakStore.ts` pattern: Zustand + Immer + MMKV.

```
State:  lifetimeFreedBytes: number
Action: addFreedBytes(bytes: number) — adds to total, persists to MMKV
```

Hydrates from MMKV on creation. Only written after confirmed deletions in `trash.tsx`.

### 4. `stores/sessionStore.ts` — add snapshots

Two new fields:
- `mediaTypeSnapshot: Map<string, string>` — assetId → mediaType (synchronous, built at session start)
- `sizeSnapshot: Map<string, number>` — assetId → real file size in bytes (populated async after session start)

New action:
- `setSizeSnapshot(sizes: Map<string, number>)` — called once when `fetchAssetSizes` resolves

Both cleared in `resetSession()`. Mirrors existing `uriSnapshot` pattern.

### 5. `hooks/useSession.ts` — build snapshots + kick off prefetch

In `startSession()`:
1. Build `mediaTypeSnapshot` alongside existing `uriSnapshot` loop (zero-cost — same iteration)
2. Pass to `startSessionAction(newSession, uriSnapshot, mediaTypeSnapshot)`
3. After `startSessionAction`, fire-and-forget `fetchAssetSizes(newSession.assetIds)`:
   ```ts
   fetchAssetSizes(newSession.assetIds).then((sizes) => {
     useSessionStore.getState().setSizeSnapshot(sizes);
   });
   ```
   Non-blocking. Session starts immediately. Sizes arrive async.

### 6. `components/swipe/ActionOverlay.tsx` — show size on delete side

- New prop: `sizeLabel: string` (pre-formatted, e.g. `"~4.0 MB"`)
- Below "DELETE" text, add:
  ```tsx
  <Animated.Text className="text-white/70 text-sm mt-1" style={deleteLabelStyle}>
    {sizeLabel}
  </Animated.Text>
  ```
- Shares the same `deleteLabelStyle` animation — scales in sync with "DELETE"

### 7. `components/swipe/SwipeCard.tsx` — forward prop

- New prop: `sizeLabel: string`
- Pass to `<ActionOverlay translateX={translateX} sizeLabel={sizeLabel} />`

### 8. `components/swipe/SwipeStack.tsx` — compute size per card

- Select `sizeSnapshot` and `mediaTypeSnapshot` from sessionStore
- In the render loop:
  ```ts
  const realSize = sizeSnapshot.get(assetId);
  const estimatedSize = getEstimatedSize(mediaTypeSnapshot.get(assetId) ?? 'photo');
  const sizeLabel = `~${formatBytes(realSize ?? estimatedSize)}`;
  ```
- Pass `sizeLabel` to `SwipeCard`

**Re-render note**: `sizeSnapshot` changes exactly once (when prefetch completes). This triggers one re-render of SwipeStack to update all visible cards from estimates to real sizes. After that, it's stable for the session.

### 9. `components/ui/SessionCompleteSheet.tsx` — add freed stat

- New optional prop: `freedBytes?: number`
- `AnimatedStat` value type: widen to `string | number`, render number with `.toLocaleString()`, string as-is
- When `freedBytes > 0`, add third stat column with divider:
  ```
  Kept | Deleted | Freed (formatBytes)
  ```
- Stagger delay: 420ms (after Deleted at 310ms)

### 10. `app/trash.tsx` — compute freed bytes, persist, pass to sheet

After `MediaLibrary.deleteAssetsAsync` succeeds:
```ts
const sizeSnapshot = useSessionStore.getState().sizeSnapshot;
const freedBytes = idsToDelete.reduce((sum, id) => {
  const real = sizeSnapshot.get(id);
  const asset = deleteAssets.find(a => a.id === id);
  return sum + (real ?? getEstimatedSize(asset?.mediaType ?? 'photo'));
}, 0);
```
- Add `freedBytes` to `summaryStats` state
- Call `useStatsStore.getState().addFreedBytes(freedBytes)` to persist lifetime total
- Pass `freedBytes` to `SessionCompleteSheet`

### 11. `app/review/[sessionId].tsx` — no-deletion path

Pass `freedBytes={0}` to `SessionCompleteSheet`. The sheet hides the "Freed" stat when 0.

### 12. `components/ui/StorageSummary.tsx` — lifetime total

- Import `useStatsStore`, select `lifetimeFreedBytes`
- When `lifetimeFreedBytes > 0`, render a new row below existing content:
  ```tsx
  <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-white/10">
    <Text className="text-white/50 text-sm">Storage freed</Text>
    <Text className="text-green-400/90 text-base font-semibold">
      {formatBytes(lifetimeFreedBytes)}
    </Text>
  </View>
  ```

## Data flow

```
Display 1 — Delete overlay:
  session start → mediaTypeSnapshot (sync) + fetchAssetSizes (async)
  → sizeSnapshot populated async → SwipeStack re-renders once
  → SwipeStack reads sizeSnapshot (real) ?? mediaTypeSnapshot (estimate)
  → formats as sizeLabel → SwipeCard → ActionOverlay renders "~4.0 MB"
 
Display 2 — Session end:
  trash.tsx handleDelete() → compute freedBytes from sizeSnapshot + estimate fallback
  → pass to SessionCompleteSheet as prop
  → persist via statsStore.addFreedBytes()
 
Display 3 — Home screen:
  statsStore.lifetimeFreedBytes (MMKV)
  → StorageSummary reads via selector → renders "Storage freed: X MB"
```

## Re-render safety

- `mediaTypeSnapshot`: stable Map, set once per session, never changes
- `sizeSnapshot`: changes exactly once (from empty to populated). Triggers one re-render of SwipeStack. After that, stable for the rest of the session
- `sizeLabel`: string prop per card, derived from stable maps — no extra renders
- `lifetimeFreedBytes`: single number selector, changes only after confirmed deletions

## Verification

1. Start a session → check console that `fetchAssetSizes` resolves within ~1 second
2. Swipe left on a photo → delete overlay shows real size (e.g. "~3.2 MB")
3. Swipe left on a video → overlay shows real video size (e.g. "~127.4 MB")
4. Complete session with deletions → trash → confirm → SessionCompleteSheet shows "Freed: X MB"
5. Complete session with no deletions → sheet shows no "Freed" stat
6. Return to home → StorageSummary shows "Storage freed: X MB"
7. Kill and restart app → lifetime total persists
8. Test with iCloud-only photo → should fall back to estimate gracefully
9. Run `npm run lint && npm run typecheck` — both pass clean