import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';
import type { SwipeDecision } from '@/types';

const storage = createMMKV();

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadDecisions(): Map<string, SwipeDecision> {
  const raw = storage.getString(STORAGE_KEYS.reviewed);
  if (!raw) return new Map();
  try {
    return new Map(JSON.parse(raw) as Array<[string, SwipeDecision]>);
  } catch {
    return new Map();
  }
}

function saveDecisions(decisions: Map<string, SwipeDecision>) {
  storage.set(STORAGE_KEYS.reviewed, JSON.stringify(Array.from(decisions.entries())));
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface ReviewedState {
  // Persistent record of every swipe decision ever made — assetId → decision
  decisions: Map<string, SwipeDecision>;

  // Actions
  record: (assetId: string, decision: SwipeDecision) => void;
  remove: (assetId: string) => void; // for undo
  reset: () => void; // full wipe
}

export const useReviewedStore = create<ReviewedState>()(
  immer((set) => ({
    decisions: loadDecisions(), // hydrate from MMKV immediately

    record: (assetId, decision) =>
      set((state) => {
        state.decisions.set(assetId, decision);
        saveDecisions(state.decisions);
      }),

    remove: (assetId) =>
      set((state) => {
        state.decisions.delete(assetId);
        saveDecisions(state.decisions);
      }),

    reset: () =>
      set((state) => {
        state.decisions = new Map();
        saveDecisions(state.decisions);
      }),
  })),
);
