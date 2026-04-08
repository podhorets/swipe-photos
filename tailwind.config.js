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
          light: 'rgba(255,255,255,0.12)',
          border: 'rgba(255,255,255,0.20)',
          'border-strong': 'rgba(255,255,255,0.35)',
        },
        // Swipe decisions
        delete: '#FF453A',
        keep: '#30D158',
        favorite: '#FFD60A',
        // Accent
        accent: '#0A84FF',
        // Backgrounds
        'bg-dark': '#000000',
        'bg-card': 'rgba(28,28,30,0.85)',
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
