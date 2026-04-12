import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SCREEN = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
};

export const COLORS = {
  // Primary glass tints
  glass: {
    light: 'rgba(255, 255, 255, 0.12)',
    border: 'rgba(255, 255, 255, 0.20)',
    borderStrong: 'rgba(255, 255, 255, 0.35)',
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
  favorite: {
    tint: 'rgba(255, 214, 10, 0.82)',
    solid: '#FFD60A',
    label: '#FFFFFF',
  },
  // UI accents
  accent: '#0A84FF',
  accentMuted: 'rgba(10, 132, 255, 0.7)',
  destructive: '#FF453A',
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textTertiary: 'rgba(255, 255, 255, 0.40)',
  // Backgrounds
  bgDark: '#000000',
  bgCard: 'rgba(28, 28, 30, 0.85)',
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
};

export const SWIPE = {
  // Fraction of screen width to trigger a swipe commit
  threshold: 0.25,
  thresholdPx: SCREEN_WIDTH * 0.25,
  // Fast flick (px/s) completes a swipe at half the distance threshold
  velocityThresholdX: 800,
  // Upward swipe threshold for favorite
  upThresholdPx: 100,
  // Cards in the stack
  stackSize: 3,
  // Scale / translateY offsets per stack depth
  stackScale: [1, 0.96, 0.92],
  stackOffsetY: [0, 10, 20],
  stackOpacity: [1, 0.85, 0.70],
};
