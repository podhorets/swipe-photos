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
        // Accent
        accent: '#0A84FF',
        streak: '#FF9F0A',
        // Backgrounds
        'bg-dark': '#050508',
        'bg-card': 'rgba(28,28,30,0.85)',
        chrome: 'rgba(24,24,28,0.72)',
        scrim: 'rgba(5,5,8,0.55)',
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
