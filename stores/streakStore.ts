import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';
import { toDateString } from '@/lib/streakUtils';

const storage = createMMKV();

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadDates(): Set<string> {
  const raw = storage.getString(STORAGE_KEYS.streakDates);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDates(dates: Set<string>): void {
  storage.set(STORAGE_KEYS.streakDates, JSON.stringify(Array.from(dates)));
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface StreakState {
  completedDates: Set<string>;
  recordSession: () => void;
}

export const useStreakStore = create<StreakState>()(
  immer((set) => ({
    completedDates: loadDates(),

    recordSession: () =>
      set((state) => {
        state.completedDates.add(toDateString(new Date()));
        saveDates(state.completedDates);
      }),
  })),
);
