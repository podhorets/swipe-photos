import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadStaged(): Set<string> {
  const raw = storage.getString(STORAGE_KEYS.deletionStaged);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveStaged(staged: Set<string>) {
  storage.set(STORAGE_KEYS.deletionStaged, JSON.stringify(Array.from(staged)));
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface DeletionState {
  // IDs staged for deletion but not yet sent to iOS trash
  staged: Set<string>;

  // Actions
  stage: (id: string) => void;
  stageMany: (ids: string[]) => void;
  unstage: (id: string) => void;
  unstageAll: () => void;
  confirmDeletion: (deletedIds: string[]) => void; // called after deleteAssetsAsync succeeds
}

export const useDeletionStore = create<DeletionState>()(
  immer((set) => ({
    staged: loadStaged(), // hydrate from MMKV immediately

    stage: (id) =>
      set((state) => {
        state.staged.add(id);
        saveStaged(state.staged);
      }),

    stageMany: (ids) =>
      set((state) => {
        ids.forEach((id) => state.staged.add(id));
        saveStaged(state.staged);
      }),

    unstage: (id) =>
      set((state) => {
        state.staged.delete(id);
        saveStaged(state.staged);
      }),

    unstageAll: () =>
      set((state) => {
        state.staged = new Set();
        saveStaged(state.staged);
      }),

    // After iOS deleteAssetsAsync completes, remove confirmed IDs from staged
    confirmDeletion: (deletedIds) =>
      set((state) => {
        deletedIds.forEach((id) => state.staged.delete(id));
        saveStaged(state.staged);
      }),
  })),
);
