/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        romantic: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        rosewood: {
          50: '#fcf5f7',
          100: '#faebf0',
          200: '#f5d6e1',
          300: '#ebb2c8',
          400: '#dc84a7',
          500: '#c85c86',
          600: '#af436c',
          700: '#923356',
          800: '#7a2d4b',
          900: '#672942',
          950: '#3c1223',
        },
        cream: {
          50: '#fdfbf7',
          100: '#f7f4eb',
          200: '#ede6d0',
          300: '#decfa8',
          400: '#cbaf7c',
          500: '#bb9257',
          600: '#ad7c48',
          700: '#90623a',
          800: '#764e33',
          900: '#613f2b',
          950: '#342014',
        }
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        handwritten: ['"Just Another Hand"', 'cursive'],
      }
    },
  },
  plugins: [],
}
