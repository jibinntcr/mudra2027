import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mudra: {
          50: '#fdf8f3',
          100: '#faeee2',
          200: '#f4dac1',
          300: '#ecbf96',
          400: '#e29c66',
          500: '#db8044',
          600: '#cd6836',
          700: '#ab512e',
          800: '#89422b',
          900: '#6f3825',
          950: '#3c1b12',
        },
        parchment: {
          50: '#fbfaf6',
          100: '#f5f2e8',
          200: '#ebe4d1',
          300: '#ddd0b2',
        },
        gold: {
          400: '#f59e0b',
          500: '#d97706',
          600: '#b45309',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Malayalam', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Noto Serif Malayalam', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
