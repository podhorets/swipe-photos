import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';
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

      set((s) => {
        s.scanState = 'scanning';
        s.scanProgress = null;
      });

      const result = await scanSimilarGroups(capturedIndex, {
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
            s.groups = groupsSoFar;
          });
        },
        shouldAbort: () => generation !== scanGeneration,
      });

      if (generation !== scanGeneration) return; // superseded by a newer scan
      if (result === null) return; // aborted — checkpoint allows a clean resume

      const newestCreationTime = capturedIndex.reduce(
        (max, a) => Math.max(max, a.creationTime),
        0,
      );
      const data: PersistedGroups = {
        version: 1,
        groups: result.groups,
        bestIds: result.bestIds,
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
