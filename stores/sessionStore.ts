import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Session, SwipeDecision } from '@/types';
import { SESSION } from '@/constants/config';

interface SessionState {
  session: Session | null;
  currentIndex: number;
  decisions: Record<string, SwipeDecision>; // assetId → decision
  undoStack: string[]; // assetId LIFO, max SESSION.maxUndo
  // URI snapshot captured at session-start from the gallery index at that moment.
  // SwipeStack reads URIs from here instead of subscribing to the live galleryStore,
  // so buildIndex() completing or MediaLibrary delta events mid-session cannot
  // trigger uriById rebuilds or spurious auto-skips during swiping.
  uriSnapshot: Map<string, string>;

  // Actions
  startSession: (session: Session, uriSnapshot: Map<string, string>) => void;
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
    uriSnapshot: new Map(),

    startSession: (session, uriSnapshot) =>
      set((state) => {
        state.session = session;
        state.uriSnapshot = uriSnapshot;
        state.currentIndex = 0;
        state.decisions = {};
        state.undoStack = [];
      }),

    decide: (assetId, decision) =>
      set((state) => {
        // Idempotent guard: if this asset was already decided, do nothing.
        // Prevents double-advance when scheduleOnRN fires twice for the same
        // card (user swipes again before the first decide has committed).
        // undoLast() clears the decision, so re-deciding after undo works correctly.
        if (assetId in state.decisions) return;
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
        state.uriSnapshot = new Map();
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
