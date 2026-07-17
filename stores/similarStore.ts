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
      // One automatic restart when the library changes mid-scan
      for (let attempt = 0; attempt < 2; attempt++) {
        const capturedIndex = useGalleryStore.getState().index;
        if (capturedIndex.length === 0) return;

        set((s) => {
          s.scanState = 'scanning';
          s.scanProgress = null;
        });

        const indexChanged = () => useGalleryStore.getState().index !== capturedIndex;
        const result = await scanSimilarGroups(capturedIndex, {
          onProgress: (processed, total, phase) => {
            if (generation !== scanGeneration) return;
            set((s) => {
              s.scanProgress = { processed, total, phase };
            });
          },
          shouldAbort: () => generation !== scanGeneration || indexChanged(),
        });

        if (generation !== scanGeneration) return; // superseded by a newer scan

        if (result === null) {
          if (indexChanged()) continue; // library changed mid-scan → one retry
          return;
        }

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
        return;
      }

      // Both attempts aborted — leave previous results in place
      if (generation === scanGeneration) {
        set((s) => {
          s.scanState = s.scannedAt > 0 ? 'done' : 'idle';
          s.scanProgress = null;
        });
      }
    },
  })),
);
