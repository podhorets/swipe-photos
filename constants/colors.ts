import { vars } from 'nativewind';

/**
 * Design tokens for the two app themes — Light primary ("Mist") and Dark
 * primary ("Night Sky"). Values are copied verbatim from the design handoff
 * (docs/design/handoff/tokens.json); screens never use a hex directly, only a
 * token, through a className (`bg-card`, `text-fg-2`) or `useTheme()`.
 *
 * Rules
 *  - Keep (green) and delete (red) colours mean ONLY keep/delete. Toggles and
 *    selected states use accent.
 *  - Feed and the photo preview always render with `dark` on pure black.
 */

export type TileColor = 'blue' | 'teal' | 'amber' | 'sky' | 'rose' | 'green';
export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  /** Screen background. Light is a vertical gradient, dark is flat. */
  background: { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] };
  /** Flat stand-in for the background: navigator scenes, launch, fallbacks. */
  screen: string;
  /** Colour behind modal sheets (Trash). */
  sheetBehind: string;

  text: { primary: string; secondary: string; tertiary: string; onButton: string };

  surface: {
    card: string;
    cardBorder: string;
    /** Track behind segmented controls / inputs. */
    raised: string;
    segmentActive: string;
    segmentActiveText: string;
    divider: string;
  };

  accent: {
    /** Progress bars, rings, selected borders, icons. */
    primary: string;
    /** Filled buttons with white text (Start, Continue, Review). */
    button: string;
    /** Light tint: active tab pill, chips, icon wells. */
    tint: string;
    /** Text/icons placed on `tint`. */
    onTint: string;
    link: string;
    /** Secondary progress segment. */
    soft: string;
  };

  track: string;
  dot: { off: string; done: string; doneFg: string };

  keep: { ring: string; tint: string; icon: string; text: string };
  remove: { ring: string; tint: string; icon: string; fill: string };

  streak: { bg: string; text: string; flame: string };
  star: string;
  badge: { bg: string; text: string };

  tabBar: { bg: string; border: string };
  /** Chips that sit on top of photos (date, size, "Best", counts). */
  photoChip: { bg: string; text: string };
  toggleOff: string;
  toggleOn: string;

  tile: Record<TileColor, { bg: string; fg: string }>;

  /** CSS box-shadow strings (RN `boxShadow` style, New Architecture). */
  shadow: { card: string; floating: string; swipeCard: string };
}

export const light: Theme = {
  mode: 'light',
  background: { colors: ['#DDE7F3', '#EEF3F9', '#F6F8FC'], locations: [0, 0.45, 1] },
  screen: '#EEF3F9',
  sheetBehind: '#C3D2E4',
  text: { primary: '#12233D', secondary: '#4D5E78', tertiary: '#5B6B84', onButton: '#FFFFFF' },
  surface: {
    card: '#FFFFFF',
    cardBorder: 'rgba(18,35,61,0.07)',
    raised: 'rgba(255,255,255,0.55)',
    segmentActive: '#FFFFFF',
    segmentActiveText: '#12233D',
    divider: 'rgba(18,35,61,0.08)',
  },
  accent: {
    primary: '#2457D6',
    button: '#2457D6',
    tint: '#E2EBFD',
    onTint: '#1D46B0',
    link: '#2457D6',
    soft: '#7C9DEE',
  },
  track: '#E3E9F2',
  // ✓ on the done dot is dark (≈9:1): white on #F29A0E is only 2.2:1
  dot: { off: '#E7EDF5', done: '#F29A0E', doneFg: '#1A1200' },
  keep: { ring: '#1E9E4A', tint: '#EAF7EE', icon: '#15803D', text: '#15803D' },
  remove: { ring: '#DC3B32', tint: '#FFF1F0', icon: '#C9302C', fill: '#CF3A30' },
  streak: { bg: '#FFFFFF', text: '#B45309', flame: '#FFE3C2' },
  star: '#F5B700',
  badge: { bg: '#FFB800', text: '#1A1200' },
  tabBar: { bg: '#FFFFFF', border: 'rgba(18,35,61,0.07)' },
  photoChip: { bg: 'rgba(255,255,255,0.92)', text: '#12233D' },
  toggleOff: '#D5DDE8',
  toggleOn: '#2457D6',
  tile: {
    blue: { bg: '#E2EBFD', fg: '#2457D6' },
    teal: { bg: '#DCF1F3', fg: '#0E7380' },
    amber: { bg: '#FFEBD6', fg: '#B45309' },
    sky: { bg: '#DDEFFC', fg: '#0369A1' },
    rose: { bg: '#FDE4E7', fg: '#B4233C' },
    green: { bg: '#E3F5E8', fg: '#15803D' },
  },
  shadow: {
    card: '0px 1px 2px rgba(18,35,61,0.05), 0px 10px 24px rgba(36,87,214,0.09)',
    floating: '0px 8px 24px rgba(36,87,214,0.12)',
    swipeCard: '0px 18px 40px rgba(18,35,61,0.22)',
  },
};

export const dark: Theme = {
  mode: 'dark',
  background: { colors: ['#0D1729', '#0D1729'], locations: [0, 1] },
  screen: '#0D1729',
  sheetBehind: '#060C17',
  text: { primary: '#EEF3FB', secondary: '#9DADC6', tertiary: '#8C9CB5', onButton: '#FFFFFF' },
  surface: {
    card: '#17243A',
    cardBorder: 'rgba(255,255,255,0.06)',
    raised: '#111D31',
    segmentActive: '#22375A',
    segmentActiveText: '#EEF3FB',
    divider: 'rgba(255,255,255,0.07)',
  },
  accent: {
    primary: '#5B8DEF',
    button: '#3B6FE0',
    tint: '#22375A',
    onTint: '#A9C6FF',
    link: '#8DB4FF',
    soft: '#2E4A78',
  },
  track: '#24344F',
  dot: { off: '#22324B', done: '#F29A0E', doneFg: '#1A1200' },
  keep: { ring: '#3FBF6A', tint: 'rgba(74,222,128,0.14)', icon: '#4ADE80', text: '#4ADE80' },
  remove: { ring: '#EF5B52', tint: 'rgba(248,113,113,0.14)', icon: '#F87171', fill: '#CF3A30' },
  streak: { bg: '#17243A', text: '#FBBF5B', flame: 'rgba(251,191,91,0.18)' },
  star: '#F5B700',
  badge: { bg: '#FFB800', text: '#1A1200' },
  tabBar: { bg: '#17243A', border: 'rgba(255,255,255,0.06)' },
  photoChip: { bg: 'rgba(13,23,41,0.78)', text: '#EEF3FB' },
  toggleOff: '#2A3B57',
  toggleOn: '#3B6FE0',
  tile: {
    blue: { bg: '#1F3352', fg: '#8DB4FF' },
    teal: { bg: '#123A40', fg: '#5FD3DF' },
    amber: { bg: '#3A2A14', fg: '#F5B460' },
    sky: { bg: '#14324A', fg: '#7CC8F5' },
    rose: { bg: '#3D1C26', fg: '#F59AAE' },
    green: { bg: '#163A27', fg: '#6EE7A0' },
  },
  shadow: {
    card: '0px 10px 24px rgba(0,0,0,0.25)',
    floating: '0px 8px 24px rgba(0,0,0,0.40)',
    // Same as light, per the handoff
    swipeCard: '0px 18px 40px rgba(18,35,61,0.22)',
  },
};

export const THEMES: Record<ThemeMode, Theme> = { light, dark };

/** Feed and the photo preview: always dark tokens on pure black. */
export const FEED_BACKGROUND = '#000000';

/**
 * Anything drawn ON a photo keeps these in both themes (text over the bottom
 * scrim, the swipe keep/delete overlays).
 */
export const ON_PHOTO = {
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.9)',
  scrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)'] as const,
  scrimLocations: [0.35, 1] as const,
  /** Dims a photo headed for deletion */
  dim: 'rgba(0,0,0,0.35)',
  keepOverlay: 'rgba(30,158,74,0.82)',
  deleteOverlay: 'rgba(207,58,48,0.82)',
};

/**
 * Placeholder art behind demo cards (onboarding, paywall) until the photo
 * loads: soft tile-colour gradients, never blue→violet.
 */
export const DEMO_GRADIENTS = {
  sky: ['#7CC8F5', '#2457D6'],
  teal: ['#5FD3DF', '#0E7380'],
  amber: ['#F5B460', '#B45309'],
  rose: ['#F59AAE', '#B4233C'],
  green: ['#6EE7A0', '#15803D'],
} as const satisfies Record<string, readonly [string, string]>;

/**
 * Tailwind colour name → token. tailwind.config.js maps each name to
 * `var(--name)`; THEME_VARS sets the variables per theme (scripts/theme-audit
 * checks that the two lists match).
 */
export const TOKENS = {
  fg: (t: Theme) => t.text.primary,
  'fg-2': (t: Theme) => t.text.secondary,
  'fg-3': (t: Theme) => t.text.tertiary,
  'on-button': (t: Theme) => t.text.onButton,
  screen: (t: Theme) => t.screen,
  sheet: (t: Theme) => t.sheetBehind,
  card: (t: Theme) => t.surface.card,
  hairline: (t: Theme) => t.surface.cardBorder,
  raised: (t: Theme) => t.surface.raised,
  segment: (t: Theme) => t.surface.segmentActive,
  'segment-fg': (t: Theme) => t.surface.segmentActiveText,
  divider: (t: Theme) => t.surface.divider,
  accent: (t: Theme) => t.accent.primary,
  button: (t: Theme) => t.accent.button,
  tint: (t: Theme) => t.accent.tint,
  'on-tint': (t: Theme) => t.accent.onTint,
  link: (t: Theme) => t.accent.link,
  soft: (t: Theme) => t.accent.soft,
  track: (t: Theme) => t.track,
  'dot-off': (t: Theme) => t.dot.off,
  'dot-done': (t: Theme) => t.dot.done,
  'dot-done-fg': (t: Theme) => t.dot.doneFg,
  'keep-ring': (t: Theme) => t.keep.ring,
  'keep-tint': (t: Theme) => t.keep.tint,
  'keep-icon': (t: Theme) => t.keep.icon,
  'keep-text': (t: Theme) => t.keep.text,
  'del-ring': (t: Theme) => t.remove.ring,
  'del-tint': (t: Theme) => t.remove.tint,
  'del-icon': (t: Theme) => t.remove.icon,
  'del-fill': (t: Theme) => t.remove.fill,
  'streak-bg': (t: Theme) => t.streak.bg,
  'streak-fg': (t: Theme) => t.streak.text,
  'streak-flame': (t: Theme) => t.streak.flame,
  star: (t: Theme) => t.star,
  badge: (t: Theme) => t.badge.bg,
  'badge-fg': (t: Theme) => t.badge.text,
  tab: (t: Theme) => t.tabBar.bg,
  'tab-border': (t: Theme) => t.tabBar.border,
  chip: (t: Theme) => t.photoChip.bg,
  'chip-fg': (t: Theme) => t.photoChip.text,
  'toggle-off': (t: Theme) => t.toggleOff,
  'toggle-on': (t: Theme) => t.toggleOn,
  'tile-blue': (t: Theme) => t.tile.blue.bg,
  'tile-blue-fg': (t: Theme) => t.tile.blue.fg,
  'tile-teal': (t: Theme) => t.tile.teal.bg,
  'tile-teal-fg': (t: Theme) => t.tile.teal.fg,
  'tile-amber': (t: Theme) => t.tile.amber.bg,
  'tile-amber-fg': (t: Theme) => t.tile.amber.fg,
  'tile-sky': (t: Theme) => t.tile.sky.bg,
  'tile-sky-fg': (t: Theme) => t.tile.sky.fg,
  'tile-rose': (t: Theme) => t.tile.rose.bg,
  'tile-rose-fg': (t: Theme) => t.tile.rose.fg,
  'tile-green': (t: Theme) => t.tile.green.bg,
  'tile-green-fg': (t: Theme) => t.tile.green.fg,
} satisfies Record<string, (t: Theme) => string>;

export type TokenName = keyof typeof TOKENS;

function toVars(t: Theme) {
  const out: Record<string, string> = {};
  for (const [name, get] of Object.entries(TOKENS)) out[`--${name}`] = get(t);
  return vars(out);
}

/** Built once: a stable object per theme, so switching never remounts the tree. */
export const THEME_VARS: Record<ThemeMode, ReturnType<typeof vars>> = {
  light: toVars(light),
  dark: toVars(dark),
};
