/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        carbon: {
          950: '#050505',
          900: '#0a0a0a',
          850: '#0f0f0f',
          800: '#141414',
          750: '#1a1a1a',
          700: '#222222',
          600: '#2e2e2e',
          500: '#404040',
          400: '#737373',
          300: '#a3a3a3',
          200: '#d4d4d4',
          100: '#f5f5f5',
        },
        ather: {
          mint: '#00E599',
          mintDark: '#00B377',
          mintGlow: 'rgba(0, 229, 153, 0.15)',
          electric: '#00E5FF',
          accent: '#ffffff',
        },
      },
      boxShadow: {
        'glow-white': '0 0 25px -3px rgba(255, 255, 255, 0.15)',
        'glow-mint': '0 0 25px -3px rgba(0, 229, 153, 0.25)',
        'glow-subtle': '0 0 15px -2px rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
}
