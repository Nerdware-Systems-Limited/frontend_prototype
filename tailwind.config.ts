import type { Config } from 'tailwindcss'

/**
 * UAPTS Wireframe Palette (light theme - institutional blue + gold)
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
        // Wireframe --primary (institutional blue)
        primary: {
          DEFAULT: '#0D4C8B',
          lt: '#2E7BC4',
          dk: '#093A6B',
          dkr: '#06294D',
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

        // ── Instrument-panel tokens (mirrors theme.css :root additions) ──
        surface: {
          page:   '#E4E9F0',
          1:      '#F8FAFC',
          2:      '#FFFFFF',
          sunken: '#DCE3EC',
          quiet:  '#E7EDF5',
        },
        ink: {
          1: '#16202B',
          2: '#4A5A6E',
          3: '#586778',
        },
        line: {
          subtle:      '#D5DEE9',
          interactive: '#7B8EA8',
        },
        'status-success': { fg: '#146C33', bg: 'rgba(20,108,51,.12)' },
        'status-warning': { fg: '#8A5A00', bg: 'rgba(138,90,0,.12)' },
        'status-danger':  { fg: '#B42318', bg: 'rgba(180,35,24,.12)' },
        'status-info':    { fg: '#0D4C8B', bg: 'rgba(13,76,139,.10)' },
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        // ── Instrument-panel radius scale (mirrors --r-* in theme.css) ──
        xs:      '4px',
        panel:   '8px',
        card:    '12px',
        surface: '16px',
        full:    '999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,23,42,.06)',
        DEFAULT: '0 4px 10px rgba(15,23,42,.08)',
        md: '0 4px 10px rgba(15,23,42,.08)',
        lg: '0 10px 24px rgba(15,23,42,.10)',
        card: '0 1px 2px rgba(15,23,42,.06)',
        // ── Instrument-panel elevation (mirrors --elev-* in theme.css) ──
        'elev-1': '0 1px 2px rgba(22,32,43,.05), 0 1px 3px rgba(22,32,43,.04)',
        'elev-2': '0 4px 10px rgba(22,32,43,.07), 0 2px 4px rgba(22,32,43,.05)',
        'elev-3': '0 12px 28px rgba(22,32,43,.12), 0 4px 8px rgba(22,32,43,.06)',
      },
      transitionDuration: {
        fast:  '120ms',
        base:  '180ms',
        slow:  '260ms',
        panel: '320ms',
      },
      transitionTimingFunction: {
        out:      'cubic-bezier(.2,.8,.3,1)',
        standard: 'cubic-bezier(.4,0,.2,1)',
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
