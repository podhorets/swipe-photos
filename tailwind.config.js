// Theme colours: each name resolves to a CSS variable set per theme by
// THEME_VARS in constants/colors.ts (keep the two lists identical —
// `npm run audit:theme` checks). No alpha modifiers on these (`bg-fg/10`):
// the variables hold full colour values.
const THEME_TOKENS = [
  'fg', 'fg-2', 'fg-3', 'on-button',
  'screen', 'sheet', 'card', 'hairline', 'raised', 'segment', 'segment-fg', 'divider',
  'accent', 'button', 'tint', 'on-tint', 'link', 'soft',
  'track', 'dot-off', 'dot-done', 'dot-done-fg',
  'keep-ring', 'keep-tint', 'keep-icon', 'keep-text',
  'del-ring', 'del-tint', 'del-icon', 'del-fill',
  'streak-bg', 'streak-fg', 'streak-flame', 'star', 'badge', 'badge-fg',
  'tab', 'tab-border', 'chip', 'chip-fg', 'toggle-off', 'toggle-on',
  'tile-blue', 'tile-blue-fg', 'tile-teal', 'tile-teal-fg', 'tile-amber', 'tile-amber-fg',
  'tile-sky', 'tile-sky-fg', 'tile-rose', 'tile-rose-fg', 'tile-green', 'tile-green-fg',
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './stores/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(THEME_TOKENS.map((name) => [name, `var(--${name})`])),
        // On photos and the always-dark Feed: identical in both themes
        'on-photo': '#FFFFFF',
        'on-photo-2': 'rgba(255,255,255,0.9)',
        feed: '#000000',
        // ── Legacy (removed once every screen uses the theme tokens) ──
        // Glass surfaces
        glass: {
          light: 'rgba(255,255,255,0.07)',
          border: 'rgba(255,255,255,0.12)',
          'border-strong': 'rgba(255,255,255,0.28)',
        },
        // Flat glass surfaces (no backdrop blur — list rows, sections)
        'glass-6': 'rgba(255,255,255,0.06)',
        'glass-7': 'rgba(255,255,255,0.07)',
        // Swipe decisions
        delete: '#FF453A',
        keep: '#30D158',
        // Accent (legacy `accent` is now the theme token above)
        streak: '#FF9F0A',
        // Backgrounds
        'bg-dark': '#050508',
        'bg-card': 'rgba(28,28,30,0.85)',
        chrome: 'rgba(24,24,28,0.72)',
        scrim: 'rgba(5,5,8,0.55)',
      },
      fontFamily: {
        // Nunito ExtraBold: titles, big numbers, review titles. Never combine
        // with a font-weight class — iOS would fall back to the system font.
        display: ['Nunito_800ExtraBold'],
        'display-bold': ['Nunito_700Bold'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
    },
  },
  plugins: [],
};
