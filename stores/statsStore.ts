import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

interface StatsState {
  lifetimeFreedBytes: number;
  lifetimeDeletedCount: number;
  addFreedBytes: (bytes: number) => void;
  addDeletedCount: (count: number) => void;
}

export const useStatsStore = create<StatsState>()(
  immer((set) => {
    const storedBytes = storage.getString(STORAGE_KEYS.statsFreedBytes);
    const initialFreed = storedBytes ? parseInt(storedBytes, 10) : 0;

    const storedCount = storage.getString(STORAGE_KEYS.statsDeletedCount);
    const initialCount = storedCount ? parseInt(storedCount, 10) : 0;

    return {
      lifetimeFreedBytes: isNaN(initialFreed) ? 0 : initialFreed,
      lifetimeDeletedCount: isNaN(initialCount) ? 0 : initialCount,
      addFreedBytes: (bytes) =>
        set((state) => {
          state.lifetimeFreedBytes += bytes;
          storage.set(STORAGE_KEYS.statsFreedBytes, state.lifetimeFreedBytes.toString());
        }),
      addDeletedCount: (count) =>
        set((state) => {
          state.lifetimeDeletedCount += count;
          storage.set(STORAGE_KEYS.statsDeletedCount, state.lifetimeDeletedCount.toString());
        }),
    };
  })
);
