/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#2c3e50",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        red: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#e74c3c",
          600: "#c0392b",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          950: "#450a0a",
        },
        gray: {
          50: "#f8f9fa",
          100: "#eeeeee",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#666666",
          600: "#4b5563",
          700: "#374151",
          800: "#333333",
          900: "#111827",
          950: "#030712",
        },
      },
      fontFamily: {
        sans: ["Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 4px rgba(0,0,0,0.1)",
        "card-hover": "0 4px 8px rgba(0,0,0,0.2)",
      },
      borderRadius: {
        card: "12px",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out",
        "fade-in-delay-1": "fadeIn 0.6s ease-out 0.2s both",
        "fade-in-delay-2": "fadeIn 0.6s ease-out 0.4s both",
        "fade-in-delay-3": "fadeIn 0.6s ease-out 0.6s both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};


