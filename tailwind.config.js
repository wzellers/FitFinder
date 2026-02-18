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
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#FAFAFA',
          card: '#FFFFFF',
          muted: '#F3F4F6',
          dark: '#111827',
        },
        accent: {
          DEFAULT: '#2563EB',
          light: '#DBEAFE',
          hover: '#1D4ED8',
        },
      },
    },
  },
  plugins: [],
};
