import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SCREEN = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
};

// Review card dimensions — preload/decode sizes MUST match render size
export const REVIEW_CARD = {
  width: SCREEN_WIDTH - 56,
  height: Math.round(SCREEN_HEIGHT * 0.66),
};

export const SPRING = {
  // Card snap-back
  snappy: { damping: 20, stiffness: 280, mass: 0.8 },
  // Card fly-off
  flyOff: { damping: 14, stiffness: 120 },
  // Stack promote (card 2→1) — overdamped, no overshoot
  promote: { damping: 34, stiffness: 250 },
  // UI element press
  press: { damping: 22, stiffness: 350, mass: 0.6 },
  // Modal / sheet entrance
  modal: { damping: 28, stiffness: 300 },
  // Onboarding slide transition — quick, critically damped settle (~400ms),
  // the pace of a native iOS pager; no overshoot
  slide: { damping: 28, stiffness: 220, mass: 0.9 },
};

export const SWIPE = {
  // Fraction of screen width to trigger a swipe commit
  threshold: 0.25,
  thresholdPx: SCREEN_WIDTH * 0.25,
  // Fast flick (px/s) completes a swipe at half the distance threshold
  velocityThresholdX: 800,
  // Preview drag-to-dismiss (vertical). Looser than the card threshold — the
  // preview is a peek, so it should let go with little effort.
  dismissThresholdPx: SCREEN_HEIGHT * 0.14,
  velocityThresholdY: 900,
  // Cards in the stack
  stackSize: 3,
  // Scale / translateY offsets per stack depth
  stackScale: [1, 0.96, 0.92],
  stackOffsetY: [0, 10, 20],
  stackOpacity: [1, 0.85, 0.70],
};
