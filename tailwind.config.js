/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          pink: '#FF10F0',
          green: '#00FF41',
          cyan: '#00FFFF',
          purple: '#9D00FF',
          yellow: '#FFFF00',
        },
        dark: {
          bg: '#0A0E27',
          card: '#1A1F3A',
          border: '#2D3561',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#E0E0E0',
          },
        },
      },
    },
  },
  plugins: [],
}
