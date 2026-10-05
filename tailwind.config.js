/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        wide: ['var(--font-wide)', 'var(--font-sans)', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#0A0A0A',
          light: '#EEF2FD',
          hover: '#262626',
        },
      },
    },
  },
  plugins: [],
};
