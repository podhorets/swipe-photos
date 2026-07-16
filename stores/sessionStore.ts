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
  // Group-review undo (similar sessions): each entry is the batch of assetIds
  // applied by one decideMany call. Kept separate from the per-asset undoStack
  // so classic undoLast can never half-undo a group.
  groupUndoStack: string[][];
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
    sizeSnapshot: Map<string, number>,
  ) => void;
  setSize: (assetId: string, size: number) => void;
  decide: (assetId: string, decision: SwipeDecision) => void;
  undoLast: () => string | null; // returns the restored assetId or null
  // Apply one group's decisions atomically (similar sessions)
  decideMany: (map: Record<string, SwipeDecision>) => void;
  // Undo the most recent decideMany; returns the restored assetIds or null
  undoLastGroup: () => string[] | null;
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
    groupUndoStack: [],
    lastAction: null,
    uriSnapshot: new Map(),
    mediaTypeSnapshot: new Map(),
    sizeSnapshot: new Map(),

    startSession: (session, uriSnapshot, mediaTypeSnapshot, sizeSnapshot) =>
      set((state) => {
        state.phase = 'active';
        state.session = session;
        state.uriSnapshot = uriSnapshot;
        state.mediaTypeSnapshot = mediaTypeSnapshot;
        state.sizeSnapshot = sizeSnapshot;
        state.currentIndex = 0;
        state.decisions = {};
        state.undoStack = [];
        state.groupUndoStack = [];
        state.lastAction = null;
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

    decideMany: (map) =>
      set((state) => {
        // Apply only undecided ids (idempotent per asset, like decide()),
        // preserving the invariant currentIndex === Object.keys(decisions).length
        const applied: string[] = [];
        for (const [assetId, decision] of Object.entries(map)) {
          if (assetId in state.decisions) continue;
          state.decisions[assetId] = decision;
          applied.push(assetId);
        }
        if (applied.length === 0) return;
        state.currentIndex = Math.min(
          state.currentIndex + applied.length,
          state.session?.assetIds.length ?? 0,
        );
        state.groupUndoStack.push(applied);
        if (state.groupUndoStack.length > SESSION.maxUndo) {
          state.groupUndoStack.shift();
        }
        state.lastAction = 'swipe';
      }),

    undoLastGroup: () => {
      const { groupUndoStack } = get();
      if (groupUndoStack.length === 0) return null;

      let restored: string[] | null = null;
      set((state) => {
        const ids = state.groupUndoStack.pop();
        if (!ids || ids.length === 0) return;
        restored = ids;
        for (const id of ids) {
          delete state.decisions[id];
        }
        state.currentIndex = Math.max(0, state.currentIndex - ids.length);
        state.lastAction = 'undo';
      });
      return restored;
    },

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
        state.groupUndoStack = [];
        state.lastAction = null;
      }),

    getCurrentAssetId: () => {
      const { session, currentIndex } = get();
      if (!session) return null;
      return session.assetIds[currentIndex] ?? null;
    },
  })),
);
