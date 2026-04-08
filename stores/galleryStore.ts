import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AssetMeta } from '@/types';
import {
  getOnThisDay,
  getScreenshots,
  getVideos,
  getFavorites,
} from '@/lib/gallery/grouper';

interface CategoryCounts {
  year: number;   // total assets that have any year grouping
  month: number;  // total assets that have any month grouping
  onThisDay: number;
  screenshots: number;
  videos: number;
  favorites: number;
  random: number; // always equals total index size
}

interface GalleryState {
  index: AssetMeta[];
  favoriteIds: Set<string>;
  isIndexing: boolean;
  indexProgress: number; // 0–1
  lastIndexed: number;   // unix ms, 0 = never

  // Actions
  setIndex: (index: AssetMeta[]) => void;
  setFavoriteIds: (ids: Set<string>) => void;
  setIndexing: (indexing: boolean, progress?: number) => void;
  removeAssets: (ids: string[]) => void;
  applyDelta: (index: AssetMeta[]) => void;

  // Derived
  getCounts: () => CategoryCounts;
}

export const useGalleryStore = create<GalleryState>()(
  immer((set, get) => ({
    index: [],
    favoriteIds: new Set<string>(),
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

    setFavoriteIds: (ids) =>
      set((state) => {
        state.favoriteIds = ids;
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

    getCounts: () => {
      const { index, favoriteIds } = get();
      return {
        year: index.length,
        month: index.length,
        onThisDay: getOnThisDay(index).length,
        screenshots: getScreenshots(index).length,
        videos: getVideos(index).length,
        favorites: getFavorites(index, favoriteIds).length,
        random: index.length,
      };
    },
  })),
);
