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
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#FFFFFF',
          card: '#FFFFFF',
          muted: '#EFF4FF',
          dark: '#0B1220',
        },
        accent: {
          DEFAULT: '#1D4ED8',
          light: '#DBE7FF',
          hover: '#1E40AF',
        },
      },
    },
  },
  plugins: [],
};
