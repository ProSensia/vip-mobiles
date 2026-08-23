import type { Config } from "tailwindcss";

// Values mirror packages/shared/src/brand.ts (BRAND_COLORS) — kept as literals
// here rather than imported, since Tailwind's config loader resolves this
// file independently of the Next.js bundler.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08080A",
          900: "#0B0B0D",
          800: "#141417",
          700: "#1D1D21",
          600: "#2A2A30",
        },
        gold: {
          50: "#FDF6E3",
          100: "#FBEBC2",
          200: "#F6D680",
          300: "#F0C04D",
          400: "#E8AA2E",
          500: "#D4941E",
          600: "#B8791A",
          700: "#8F5D14",
          800: "#6B4610",
          900: "#4A300B",
        },
        cream: "#F5F1E8",
        muted: "#A8A29A",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        gold: "0 8px 30px -8px rgba(212, 148, 30, 0.35)",
        card: "0 2px 20px -4px rgba(0, 0, 0, 0.45)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        shimmer: "shimmer 1.6s infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "0%": { backgroundPosition: "-500px 0" }, "100%": { backgroundPosition: "500px 0" } },
      },
    },
  },
  plugins: [],
};

export default config;
