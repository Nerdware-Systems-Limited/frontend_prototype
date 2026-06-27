import type { Config } from 'tailwindcss'

/**
 * UAPTS Wireframe Palette (light theme - Kenya government green + gold)
 *
 * Wireframes (theme.css) use raw CSS variables on :root; this Tailwind config
 * mirrors them so we can use utility classes while keeping the same tokens.
 *
 * The full wireframe styling still lives in app/assets/css/theme.css (loaded
 * via nuxt.config.ts) - Tailwind here is supplementary for utility-class use.
 */
export default {
  content: [
    './app/**/*.{vue,js,ts,jsx,tsx}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
  ],
  // Light theme only - wireframes are not dark mode.
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        // Page background = wireframe --bg
        bg: {
          DEFAULT: '#f3f4f6',
          2: '#e5e7eb',
          3: '#d1d5db',
        },
        // Wireframe --card
        card: {
          DEFAULT: '#ffffff',
          hover: '#fafbfc',
          border: '#d1d5db',
        },
        // Wireframe --primary (Kenya green)
        primary: {
          DEFAULT: '#006838',
          lt: '#0b8a4c',
          dk: '#004d28',
          dkr: '#003a1e',
          fg: '#ffffff',
        },
        // Wireframe --accent (gold)
        accent: {
          DEFAULT: '#FDB913',
          dk: '#d99a0f',
          fg: '#1a1a2e',
        },
        // Wireframe --success / --warning / --destructive / --info
        success: '#22c55e',
        warning: '#f59e0b',
        danger:  '#ef4444',
        info:    '#1f5fb4',
        // Wireframe --fg / --fg2 / --fg3
        fg: {
          DEFAULT: '#1a1a2e',
          muted:   '#4b5563',
          dim:     '#9ca3af',
        },
        // Wireframe secondary accents
        'accent-purple': '#8b5cf6',
        'accent-cyan':   '#06b6d4',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,23,42,.06)',
        DEFAULT: '0 4px 10px rgba(15,23,42,.08)',
        md: '0 4px 10px rgba(15,23,42,.08)',
        lg: '0 10px 24px rgba(15,23,42,.10)',
        card: '0 1px 2px rgba(15,23,42,.06)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
