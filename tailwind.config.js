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
        poster: ['var(--font-poster)', 'Impact', 'sans-serif'],
        script: ['var(--font-script)', 'cursive'],
      },
      colors: {
        accent: {
          DEFAULT: '#5C1A26',
          light: '#EDF6FB',
          hover: '#48121D',
        },
      },
    },
  },
  plugins: [],
};
