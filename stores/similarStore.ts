import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { SIMILAR, STORAGE_KEYS } from '@/constants/config';
import { scanSimilarGroups, type ScanPhase } from '@/lib/similar/similarScan';
import { useGalleryStore } from '@/stores/galleryStore';

const storage = createMMKV();

// ─── Persistence ──────────────────────────────────────────────────────────────

interface PersistedGroups {
  version: 1;
  groups: string[][];
  bestIds: string[];
  scannedAt: number;
  scannedNewestCreationTime: number;
  analyzerUsed: boolean;
}

function loadPersisted(): PersistedGroups | null {
  const raw = storage.getString(STORAGE_KEYS.similarGroups);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedGroups;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function savePersisted(data: PersistedGroups): void {
  storage.set(STORAGE_KEYS.similarGroups, JSON.stringify(data));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export type ScanState = 'idle' | 'scanning' | 'done';

interface SimilarState {
  /** Raw scan output — stable; filter with filterGroupsForReview at read time. */
  groups: string[][];
  bestIds: Set<string>;
  scanState: ScanState;
  scanProgress: { processed: number; total: number; phase: ScanPhase } | null;
  scannedAt: number; // 0 = never scanned
  scannedNewestCreationTime: number;
  analyzerUsed: boolean;
  runScan: () => Promise<void>;
}

const persisted = loadPersisted();

// Generation counter lets an aborted/superseded scan's late writes be dropped
let scanGeneration = 0;

export const useSimilarStore = create<SimilarState>()(
  immer((set, get) => ({
    groups: persisted?.groups ?? [],
    bestIds: new Set(persisted?.bestIds ?? []),
    scanState: persisted ? 'done' : 'idle',
    scanProgress: null,
    scannedAt: persisted?.scannedAt ?? 0,
    scannedNewestCreationTime: persisted?.scannedNewestCreationTime ?? 0,
    analyzerUsed: persisted?.analyzerUsed ?? false,

    runScan: async () => {
      if (get().scanState === 'scanning') return;

      const generation = ++scanGeneration;
      // Snapshot the index for the whole scan. Mid-scan library changes do NOT
      // abort: deletions are handled by read-time filtering, and new photos are
      // picked up by the next staleness check — aborting would throw away
      // minutes of Vision work every time a review completes during the scan.
      const capturedIndex = useGalleryStore.getState().index;
      if (capturedIndex.length === 0) return;

      // A full library re-compare runs ONLY on the first scan ever (or after
      // results are cleared). Every rescan after that is incremental: it only
      // re-compares the newest N assets and stitches the result onto the groups
      // already found, so "took a photo" never re-feature-prints the whole
      // library. Trade-off: old-timestamped imports past the slice are not
      // re-grouped — there is no periodic full reconcile by design.
      const { scannedAt: prevScannedAt, groups: prevGroups, bestIds: prevBestIds } = get();
      // scannedAt !== 0 means a full scan completed and was persisted — even if
      // it found zero groups (tidy library), later rescans must stay incremental.
      const incremental = prevScannedAt !== 0;

      // Newest N assets for the incremental pass, expanded to WHOLE groups: a
      // prior group straddling the slice boundary is pulled in entirely and
      // re-compared, instead of being half-dropped (which would permanently
      // orphan its out-of-slice members as the window slides forward).
      // `keptGroups` — prior groups with no member in the scan set — are stable
      // for the whole scan, so streamed slice-groups merge onto them live
      // instead of blanking the tab.
      let scanIndex = capturedIndex;
      let recentIds = new Set<string>();
      if (incremental) {
        recentIds = new Set(
          capturedIndex.slice(0, SIMILAR.incrementalAssetCount).map((a) => a.id),
        );
        for (const g of prevGroups) {
          if (g.some((id) => recentIds.has(id))) {
            for (const id of g) recentIds.add(id);
          }
        }
        scanIndex = capturedIndex.filter((a) => recentIds.has(a.id));
      }
      const keptGroups = incremental
        ? prevGroups.filter((g) => g.every((id) => !recentIds.has(id)))
        : [];

      set((s) => {
        s.scanState = 'scanning';
        s.scanProgress = null;
      });

      const result = await scanSimilarGroups(scanIndex, {
        // Slice-scans run over a partial index — never touch the full-scan
        // checkpoint, which is keyed on the whole library's photo count.
        skipCheckpoint: incremental,
        onProgress: (processed, total, phase) => {
          if (generation !== scanGeneration) return;
          set((s) => {
            s.scanProgress = { processed, total, phase };
          });
        },
        // Stream groups as compare batches land so the tab fills up live and
        // a review can start seconds into a first scan. Not persisted here —
        // the per-batch checkpoint covers restarts until the final swap.
        onGroups: (groupsSoFar) => {
          if (generation !== scanGeneration) return;
          set((s) => {
            s.groups = incremental ? [...keptGroups, ...groupsSoFar] : groupsSoFar;
          });
        },
        shouldAbort: () => generation !== scanGeneration,
      });

      if (generation !== scanGeneration) return; // superseded by a newer scan
      // Aborted: a full scan resumes from its checkpoint next run; an aborted
      // incremental scan (no checkpoint) just redoes its small slice.
      if (result === null) return;

      // Newest time comes from the FULL index (not just the slice) so the
      // staleness check won't re-trigger for photos we already accounted for.
      const newestCreationTime = capturedIndex.reduce(
        (max, a) => Math.max(max, a.creationTime),
        0,
      );
      const groups = incremental ? [...keptGroups, ...result.groups] : result.groups;
      const bestIds = incremental
        ? [
            ...new Set([
              ...keptGroups.flat().filter((id) => prevBestIds.has(id)),
              ...result.bestIds,
            ]),
          ]
        : result.bestIds;
      const data: PersistedGroups = {
        version: 1,
        groups,
        bestIds,
        scannedAt: Date.now(),
        scannedNewestCreationTime: newestCreationTime,
        analyzerUsed: result.analyzerUsed,
      };
      savePersisted(data);
      set((s) => {
        s.groups = data.groups;
        s.bestIds = new Set(data.bestIds);
        s.scanState = 'done';
        s.scanProgress = null;
        s.scannedAt = data.scannedAt;
        s.scannedNewestCreationTime = data.scannedNewestCreationTime;
        s.analyzerUsed = data.analyzerUsed;
      });
    },
  })),
);
