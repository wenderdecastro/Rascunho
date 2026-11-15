/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cozy: {
          bg: "#12161A",          // Deep soothing dark background
          card: "#1C2129",        // Dark card background
          'card-hover': "#242A35",
          border: "#2A323F",      // Soft dark borders
          hover: "#222834",
          text: "#F1F5F9",        // Clean light text
          subtext: "#94A3B8",     // Slate muted text
          peach: {
            light: "#382323",
            DEFAULT: "#FCA5A5",
            dark: "#F87171"
          },
          sage: {
            light: "#183322",
            DEFAULT: "#86EFAC",
            dark: "#4ADE80"
          },
          lavender: {
            light: "#2B2144",
            DEFAULT: "#B49BFA",
            dark: "#C084FC"
          },
          butter: {
            light: "#3B3314",
            DEFAULT: "#FDE047",
            dark: "#FACC15"
          },
          sky: {
            light: "#182E3E",
            DEFAULT: "#7DD3FC",
            dark: "#38BDF8"
          },
          rose: {
            light: "#391D22",
            DEFAULT: "#FDA4AF",
            dark: "#FB7185"
          }
        }
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px'
      },
      boxShadow: {
        'cozy': '0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.2)',
        'cozy-hover': '0 8px 24px -4px rgba(0, 0, 0, 0.6), 0 4px 8px -2px rgba(0, 0, 0, 0.3)',
        'cozy-pill': '0 2px 8px rgba(0, 0, 0, 0.3)'
      }
    },
  },
  plugins: [],
}
