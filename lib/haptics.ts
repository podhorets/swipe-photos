import * as Haptics from 'expo-haptics';

// iOS UIImpactFeedbackGenerator crashes under rapid overlapping prepare/impact
// calls (~<100ms apart). Module-level timestamp shared by all call sites — swipes,
// buttons, threshold-cross — so the gate holds regardless of which path fires.
const MIN_HAPTIC_INTERVAL_MS = 120;
let lastHapticTs = 0;

export function gatedHaptic(style: Haptics.ImpactFeedbackStyle): void {
  const now = Date.now();
  if (now - lastHapticTs < MIN_HAPTIC_INTERVAL_MS) return;
  lastHapticTs = now;
  Haptics.impactAsync(style).catch(() => {});
}
