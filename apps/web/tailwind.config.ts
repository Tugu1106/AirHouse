import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#38bdf8',
          DEFAULT: '#0ea5e9',
          dark: '#0284c7',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
