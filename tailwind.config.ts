import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        aubergine:        "#2D0A31",
        "hot-pink":       "#FF2D7A",
        "electric-cyan":  "#00E5FF",
        "neon-green":     "#39FF14",
        gold:             "#FFD700",
      },
      keyframes: {
        // Fixture card flashes electric cyan when a live score updates
        "cyan-flash": {
          "0%, 100%": { backgroundColor: "transparent" },
          "30%":       { backgroundColor: "rgba(0, 229, 255, 0.25)" },
        },
        // Neon-green trophy slides across on exact-score confirmation
        "trophy-slide": {
          "0%":   { transform: "translateX(-110%)", opacity: "0" },
          "15%":  { opacity: "1" },
          "85%":  { opacity: "1" },
          "100%": { transform: "translateX(110%)", opacity: "0" },
        },
        // Gold shimmer sweeps the Double Down strip
        "gold-shimmer": {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        // Bottom-sheet modal slides up
        "slide-up": {
          "0%":   { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        // Notification banner slides down from the top
        "slide-down": {
          "0%":   { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)",     opacity: "1" },
        },
        // Leaderboard rank goes up (neon green flash)
        "rank-up": {
          "0%":   { color: "#39FF14", transform: "scale(1.25)" },
          "100%": { color: "inherit", transform: "scale(1)" },
        },
        // Leaderboard rank goes down (hot pink flash)
        "rank-down": {
          "0%":   { color: "#FF2D7A", transform: "scale(1.25)" },
          "100%": { color: "inherit", transform: "scale(1)" },
        },
        // Electric-cyan pulse ring for live indicator
        "pulse-cyan": {
          "0%":   { boxShadow: "0 0 0 0 rgba(0, 229, 255, 0.7)" },
          "70%":  { boxShadow: "0 0 0 8px rgba(0, 229, 255, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(0, 229, 255, 0)" },
        },
        // Typewriter cursor blink (used in RecapCard)
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        // Newspaper card unfolds from crumpled state
        "unfold": {
          "0%":   { transform: "scale(0.05) rotate(-6deg)", opacity: "0" },
          "60%":  { transform: "scale(1.03) rotate(0.5deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)",     opacity: "1" },
        },
        // Away Day Pick fireworks burst (hot pink glow pulse)
        "fireworks": {
          "0%":   { boxShadow: "0 0 0 0 rgba(255, 45, 122, 0.9)" },
          "50%":  { boxShadow: "0 0 0 20px rgba(255, 45, 122, 0.3)" },
          "100%": { boxShadow: "0 0 0 40px rgba(255, 45, 122, 0)" },
        },
      },
      animation: {
        "cyan-flash":   "cyan-flash 0.9s ease-in-out",
        "trophy-slide": "trophy-slide 1.6s ease-in-out forwards",
        "gold-shimmer": "gold-shimmer 1.4s linear infinite",
        "slide-up":     "slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-down":   "slide-down 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        "rank-up":      "rank-up 0.6s ease-out forwards",
        "rank-down":    "rank-down 0.6s ease-out forwards",
        "pulse-cyan":   "pulse-cyan 1.5s ease-out infinite",
        "blink":        "blink 1s step-end infinite",
        "unfold":       "unfold 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fireworks":    "fireworks 0.8s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
