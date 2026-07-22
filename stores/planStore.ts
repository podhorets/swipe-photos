import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { FREE_PLAN, STORAGE_KEYS } from '@/constants/config';
import { toDateString } from '@/lib/streakUtils';

const storage = createMMKV();

// ─── Persistence ──────────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro';

interface PlanData {
  plan: Plan;
  /** Completed sessions recorded on `quotaDate`. Stale values from past days are
   *  neutralized by derivation (see lib/planUtils.ts) — never trusted directly. */
  sessionsUsedToday: number;
  /** Local YYYY-MM-DD the counter belongs to. */
  quotaDate: string;
  /** Dev-tools override; only honored behind DEV_TOOLS_ENABLED (see isPro in lib/planUtils.ts). */
  mockPro: boolean;
}

const DEFAULTS: PlanData = {
  plan: 'free',
  sessionsUsedToday: 0,
  quotaDate: '',
  mockPro: false,
};

function loadPlan(): PlanData {
  const raw = storage.getString(STORAGE_KEYS.plan);
  if (!raw) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) as Partial<PlanData> };
  } catch {
    return DEFAULTS;
  }
}

function savePlan(s: PlanData) {
  const { plan, sessionsUsedToday, quotaDate, mockPro } = s;
  storage.set(STORAGE_KEYS.plan, JSON.stringify({ plan, sessionsUsedToday, quotaDate, mockPro }));
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface PlanState extends PlanData {
  /** Called when a review session completes (same spots as streak recordSession). */
  recordCompletedSession: () => void;
  /** Set from RevenueCat entitlement sync — never call directly from UI. */
  setPlan: (plan: Plan) => void;
  setMockPro: (value: boolean) => void;
  /** Dev tool only: move today's quota counter in either direction. */
  setSessionsUsedToday: (used: number) => void;
}

export const usePlanStore = create<PlanState>()((set, get) => ({
  ...loadPlan(),

  recordCompletedSession: () => {
    const today = toDateString(new Date());
    const { quotaDate, sessionsUsedToday } = get();
    // Strict inequality: any date mismatch (including clock changes) resets the day
    const used = quotaDate === today ? sessionsUsedToday : 0;
    set({ sessionsUsedToday: used + 1, quotaDate: today });
    savePlan({ ...get() });
  },

  setPlan: (plan) => {
    set({ plan });
    savePlan({ ...get() });
  },

  setMockPro: (value) => {
    set({ mockPro: value });
    savePlan({ ...get() });
  },

  setSessionsUsedToday: (used) => {
    // Stamping today's date is what makes the value stick — a count without a
    // matching quotaDate is treated as stale and derived back to 0.
    set({
      sessionsUsedToday: Math.max(0, Math.min(FREE_PLAN.sessionsPerDay, Math.round(used))),
      quotaDate: toDateString(new Date()),
    });
    savePlan({ ...get() });
  },
}));
