import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Session, SwipeDecision } from '@/types';
import { SESSION } from '@/constants/config';

interface SessionState {
  session: Session | null;
  currentIndex: number;
  decisions: Record<string, SwipeDecision>; // assetId → decision
  undoStack: string[]; // assetId LIFO, max SESSION.maxUndo

  // Actions
  startSession: (session: Session) => void;
  decide: (assetId: string, decision: SwipeDecision) => void;
  undoLast: () => string | null; // returns the restored assetId or null
  resetSession: () => void;

  // Derived (stable primitives — safe to select directly)
  getCurrentAssetId: () => string | null;
}

export const useSessionStore = create<SessionState>()(
  immer((set, get) => ({
    session: null,
    currentIndex: 0,
    decisions: {},
    undoStack: [],

    startSession: (session) =>
      set((state) => {
        state.session = session;
        state.currentIndex = 0;
        state.decisions = {};
        state.undoStack = [];
      }),

    decide: (assetId, decision) =>
      set((state) => {
        state.decisions[assetId] = decision;
        state.currentIndex = Math.min(
          state.currentIndex + 1,
          (state.session?.assetIds.length ?? 0),
        );
        // Push to undo stack, cap at maxUndo
        state.undoStack.push(assetId);
        if (state.undoStack.length > SESSION.maxUndo) {
          state.undoStack.shift();
        }
      }),

    undoLast: () => {
      const { undoStack } = get();
      if (undoStack.length === 0) return null;

      let restoredId: string | null = null;
      set((state) => {
        const id = state.undoStack.pop();
        if (!id) return;
        restoredId = id;
        delete state.decisions[id];
        state.currentIndex = Math.max(0, state.currentIndex - 1);
      });
      return restoredId;
    },

    resetSession: () =>
      set((state) => {
        state.session = null;
        state.currentIndex = 0;
        state.decisions = {};
        state.undoStack = [];
      }),

    getCurrentAssetId: () => {
      const { session, currentIndex } = get();
      if (!session) return null;
      return session.assetIds[currentIndex] ?? null;
    },
  })),
);
