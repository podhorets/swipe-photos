import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SCREEN = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
};

export const COLORS = {
  // Primary glass tints
  glass: {
    light: 'rgba(255, 255, 255, 0.07)',
    border: 'rgba(255, 255, 255, 0.12)',
    borderStrong: 'rgba(255, 255, 255, 0.28)',
    shadow: 'rgba(0, 0, 0, 0.35)',
    innerGlow: 'rgba(255, 255, 255, 0.08)',
  },
  // Swipe decision overlays
  delete: {
    tint: 'rgba(255, 69, 58, 0.82)',
    solid: '#FF453A',
    label: '#FFFFFF',
  },
  keep: {
    tint: 'rgba(48, 209, 88, 0.82)',
    solid: '#30D158',
    label: '#FFFFFF',
  },
  // UI accents
  accent: '#0A84FF',
  accentMuted: 'rgba(10, 132, 255, 0.7)',
  destructive: '#FF453A',
  streak: '#FF9F0A',
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.55)',
  textTertiary: 'rgba(255, 255, 255, 0.40)',
  // Backgrounds
  bgDark: '#050508',
  bgCard: 'rgba(28, 28, 30, 0.85)',
  // Floating chrome surfaces (tab bar, review circles, trash bottom bar)
  bgChrome: 'rgba(24, 24, 28, 0.72)',
};

// Linear-gradient color pairs (expo-linear-gradient / svg / Skia)
export const GRADIENTS = {
  accent: ['#0A84FF', '#5E5CE6'],
  delete: ['#FF453A', '#FF6482'],
  freed: ['#30D158', '#64D2FF'],
  faceId: ['#30D158', '#64D2FF'],
  analytics: ['#BF5AF2', '#5E5CE6'],
  notify: ['#FF9F0A', '#FF6482'],
  star: ['#FF9F0A', '#FFD60A'],
  shield: ['#64D2FF', '#0A84FF'],
} as const satisfies Record<string, readonly [string, string]>;

// Ambient radial glow blobs behind screens (AuroraBackground variants)
export const AURORA = {
  violet: 'rgba(94, 92, 230, 0.30)',
  violetStrong: 'rgba(94, 92, 230, 0.35)',
  blue: 'rgba(10, 132, 255, 0.20)',
  blueStrong: 'rgba(10, 132, 255, 0.28)',
  red: 'rgba(255, 69, 58, 0.16)',
  green: 'rgba(48, 209, 88, 0.22)',
} as const;

// Review card dimensions — preload/decode sizes MUST match render size
export const REVIEW_CARD = {
  width: SCREEN_WIDTH - 56,
  height: Math.round(SCREEN_HEIGHT * 0.66),
};

export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const GLASS = {
  // Blur intensities for expo-blur
  intensity: {
    light: 40,
    medium: 65,
    heavy: 90,
  },
  // BlurView tints
  tint: 'systemMaterialDark' as const,
  tintLight: 'systemMaterial' as const,
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
