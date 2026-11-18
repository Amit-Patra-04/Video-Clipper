/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#020617', // slate-950
          surface: '#0f172a', // slate-900
          card: '#1e293b', // slate-800
          border: '#334155', // slate-700
          primary: '#6366f1', // indigo-500
          'primary-hover': '#4f46e5', // indigo-600
          accent: '#a855f7', // purple-500
          viral: '#f43f5e', // rose-500
          karaoke: '#facc15', // yellow-400
          neon: '#06b6d4', // cyan-500
          success: '#10b981' // emerald-500
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Montserrat"', 'system-ui', 'sans-serif'],
        mono: ['"Space Grotesk"', 'monospace'],
        hormozi: ['"Montserrat"', 'Impact', 'sans-serif'],
        mrbeast: ['"Montserrat"', 'sans-serif'],
        neon: ['"Space Grotesk"', 'sans-serif'],
        minimal: ['"Plus Jakarta Sans"', 'sans-serif']
      },
      boxShadow: {
        'glow-primary': '0 0 25px -5px rgba(99, 102, 241, 0.4)',
        'glow-viral': '0 0 25px -5px rgba(244, 63, 94, 0.4)',
        'glow-neon': '0 0 25px -5px rgba(6, 182, 212, 0.4)'
      }
    }
  },
  plugins: []
};
