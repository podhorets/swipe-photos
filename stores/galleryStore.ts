import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AssetMeta } from '@/types';

interface GalleryState {
  index: AssetMeta[];
  isIndexing: boolean;
  indexProgress: number; // 0–1
  lastIndexed: number;   // unix ms, 0 = never

  // Actions
  setIndex: (index: AssetMeta[]) => void;
  setIndexing: (indexing: boolean, progress?: number) => void;
  removeAssets: (ids: string[]) => void;
  applyDelta: (index: AssetMeta[]) => void;
}

export const useGalleryStore = create<GalleryState>()(
  immer((set) => ({
    index: [],
    isIndexing: false,
    indexProgress: 0,
    lastIndexed: 0,

    setIndex: (index) =>
      set((state) => {
        state.index = index;
        state.lastIndexed = Date.now();
        state.isIndexing = false;
        state.indexProgress = 1;
      }),

    setIndexing: (indexing, progress = 0) =>
      set((state) => {
        state.isIndexing = indexing;
        state.indexProgress = progress;
      }),

    removeAssets: (ids) =>
      set((state) => {
        const removed = new Set(ids);
        state.index = state.index.filter((a) => !removed.has(a.id));
      }),

    applyDelta: (index) =>
      set((state) => {
        state.index = index;
        state.lastIndexed = Date.now();
      }),
  })),
);
