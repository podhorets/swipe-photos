import { SESSION } from "@/constants/config";
import type { Session, SwipeDecision } from "@/types";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type LastAction = 'swipe' | 'undo' | null;
// 'idle'   — no session active (initial state, or after resetSession)
// 'active' — startSession was called; cards are being reviewed
export type SessionPhase = 'idle' | 'active';

interface SessionState {
  phase: SessionPhase;
  session: Session | null;
  currentIndex: number;
  decisions: Record<string, SwipeDecision>; // assetId → decision
  undoStack: string[]; // assetId LIFO, max SESSION.maxUndo
  // Direction of the most recent currentIndex transition. SwipeStack reads this
  // to decide its render slice without mutating a ref during render.
  lastAction: LastAction;
  // URI snapshot captured at session-start from the gallery index at that moment.
  // SwipeStack reads URIs from here instead of subscribing to the live galleryStore,
  // so buildIndex() completing or MediaLibrary delta events mid-session cannot
  // trigger uriById rebuilds or spurious auto-skips during swiping.
  uriSnapshot: Map<string, string>;
  mediaTypeSnapshot: Map<string, string>;
  sizeSnapshot: Map<string, number>;

  // Actions
  startSession: (
    session: Session,
    uriSnapshot: Map<string, string>,
    mediaTypeSnapshot: Map<string, string>,
  ) => void;
  setSizeSnapshot: (sizes: Map<string, number>) => void;
  setSize: (assetId: string, size: number) => void;
  decide: (assetId: string, decision: SwipeDecision) => void;
  undoLast: () => string | null; // returns the restored assetId or null
  resetSession: () => void;

  // Derived (stable primitives — safe to select directly)
  getCurrentAssetId: () => string | null;
}

export const useSessionStore = create<SessionState>()(
  immer((set, get) => ({
    phase: 'idle' as SessionPhase,
    session: null,
    currentIndex: 0,
    decisions: {},
    undoStack: [],
    lastAction: null,
    uriSnapshot: new Map(),
    mediaTypeSnapshot: new Map(),
    sizeSnapshot: new Map(),

    startSession: (session, uriSnapshot, mediaTypeSnapshot) =>
      set((state) => {
        state.phase = 'active';
        state.session = session;
        state.uriSnapshot = uriSnapshot;
        state.mediaTypeSnapshot = mediaTypeSnapshot;
        state.sizeSnapshot = new Map();
        state.currentIndex = 0;
        state.decisions = {};
        state.undoStack = [];
        state.lastAction = null;
      }),

    setSizeSnapshot: (sizes) =>
      set((state) => {
        state.sizeSnapshot = sizes;
      }),

    setSize: (assetId, size) =>
      set((state) => {
        state.sizeSnapshot.set(assetId, size);
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
          state.session?.assetIds.length ?? 0,
        );
        // Push to undo stack, cap at maxUndo
        state.undoStack.push(assetId);
        if (state.undoStack.length > SESSION.maxUndo) {
          state.undoStack.shift();
        }
        state.lastAction = 'swipe';
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
        state.lastAction = 'undo';
      });
      return restoredId;
    },

    resetSession: () =>
      set((state) => {
        state.phase = 'idle';
        state.session = null;
        state.uriSnapshot = new Map();
        state.mediaTypeSnapshot = new Map();
        state.sizeSnapshot = new Map();
        state.currentIndex = 0;
        state.decisions = {};
        state.undoStack = [];
        state.lastAction = null;
      }),

    getCurrentAssetId: () => {
      const { session, currentIndex } = get();
      if (!session) return null;
      return session.assetIds[currentIndex] ?? null;
    },
  })),
);
