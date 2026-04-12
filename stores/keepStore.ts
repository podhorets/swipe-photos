import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadKeepIds(): Set<string> {
  const raw = storage.getString(STORAGE_KEYS.keep);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveKeepIds(ids: Set<string>): void {
  storage.set(STORAGE_KEYS.keep, JSON.stringify(Array.from(ids)));
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface KeepState {
  // IDs the user has explicitly kept — written only at session end, never during swiping
  keepIds: Set<string>;

  // Actions
  addMany: (ids: string[]) => void;
  reset: () => void;
}

export const useKeepStore = create<KeepState>()(
  immer((set) => ({
    keepIds: loadKeepIds(), // hydrate from MMKV immediately

    addMany: (ids) =>
      set((state) => {
        ids.forEach((id) => state.keepIds.add(id));
        saveKeepIds(state.keepIds);
      }),

    reset: () =>
      set((state) => {
        state.keepIds = new Set();
        saveKeepIds(state.keepIds);
      }),
  })),
);
