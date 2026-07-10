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
          DEFAULT: '#3F3F76',
          light: '#DAD9EC',
          hover: '#33335F',
        },
        purple: {
          DEFAULT: '#6C8CD5',
          light: '#C9D6F0',
          hover: '#557AC4',
        },
      },
    },
  },
  plugins: [],
};
