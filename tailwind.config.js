/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['DM Mono', 'monospace'],
        syne: ['Syne', 'sans-serif'],
      },
      colors: {
        bg: '#080808',
        surface: '#0f0f0f',
        surface2: '#161616',
        surface3: '#1e1e1e',
        accent: '#e8ff47',
        'accent-dim': 'rgba(232,255,71,0.12)',
        muted: 'rgba(240,236,228,0.45)',
        dim: 'rgba(240,236,228,0.25)',
        whispr: {
          red: '#ff4757',
          purple: '#a855f7',
          gold: '#f0a500',
        }
      },
      animation: {
        'card-in': 'cardIn 0.4s ease both',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'pulse-dot': 'pulseDot 2s infinite',
        'ticker': 'ticker 25s linear infinite',
      },
      keyframes: {
        cardIn: {
          'from': { opacity: 0, transform: 'translateY(16px)' },
          'to': { opacity: 1, transform: 'translateY(0)' },
        },
        slideUp: {
          'from': { opacity: 0, transform: 'translateY(20px)' },
          'to': { opacity: 1, transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.4, transform: 'scale(0.7)' },
        },
        ticker: {
          'from': { transform: 'translateX(0)' },
          'to': { transform: 'translateX(-50%)' },
        },
      }
    },
  },
  plugins: [],
}
