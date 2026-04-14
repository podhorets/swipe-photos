import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

interface StatsState {
  lifetimeFreedBytes: number;
  addFreedBytes: (bytes: number) => void;
}

export const useStatsStore = create<StatsState>()(
  immer((set) => {
    const stored = storage.getString(STORAGE_KEYS.statsFreedBytes);
    const initialFreed = stored ? parseInt(stored, 10) : 0;

    return {
      lifetimeFreedBytes: isNaN(initialFreed) ? 0 : initialFreed,
      addFreedBytes: (bytes) =>
        set((state) => {
          state.lifetimeFreedBytes += bytes;
          storage.set(STORAGE_KEYS.statsFreedBytes, state.lifetimeFreedBytes.toString());
        }),
    };
  })
);
