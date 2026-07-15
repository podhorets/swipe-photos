import { FREE_PLAN } from '@/constants/config';
import { toDateString } from '@/lib/streakUtils';

interface PlanSnapshot {
  plan: 'free' | 'pro';
  sessionsUsedToday: number;
  quotaDate: string;
  mockPro: boolean;
}

/** True when the user has the pro entitlement (or the dev-only mock is on). */
export function isPro(state: PlanSnapshot): boolean {
  if (__DEV__ && state.mockPro) return true;
  return state.plan === 'pro';
}

/** Free sessions remaining today. Pro users always have Infinity. */
export function sessionsRemaining(state: PlanSnapshot, now: Date = new Date()): number {
  if (isPro(state)) return Infinity;
  const used = state.quotaDate === toDateString(now) ? state.sessionsUsedToday : 0;
  return Math.max(0, FREE_PLAN.sessionsPerDay - used);
}

/** Batch size actually used for sessions — clamped on free, untouched for pro. */
export function effectiveBatchSize(state: PlanSnapshot, batchSize: number): number {
  return isPro(state) ? batchSize : Math.min(batchSize, FREE_PLAN.maxBatchSize);
}

/** Milliseconds until the next local midnight (quota refill). */
export function msUntilMidnight(now: Date = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/** "h:mm" countdown string, minimum "0:01" so it never shows 0:00 while locked. */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}
