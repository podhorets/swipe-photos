import { router } from 'expo-router';
import { usePlanStore } from '@/stores/planStore';
import { sessionsRemaining } from '@/lib/planUtils';

/**
 * Call before starting any review session. Returns true when the session may
 * start; otherwise redirects to the paywall and returns false.
 *
 * Plain function (not a hook) — some callers are module-level (on-this-day's
 * reviewYear). Quota is only consumed on completion (planStore.recordCompletedSession).
 */
export function gateSessionStart(): boolean {
  if (sessionsRemaining(usePlanStore.getState()) > 0) return true;
  router.push({ pathname: '/paywall', params: { context: 'sessions' } });
  return false;
}
