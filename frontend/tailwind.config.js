/** @type {import('tailwindcss').Config} */
// CrimeNet AI — "Classified dossier" theme.
// Warm paper + ink + a single vermilion "seal" accent.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Paper surfaces ──────────────────────────────────────────────
        paper: {
          DEFAULT: "#F5F1E8", // warm ivory page
          raised: "#FCFAF5", // card / sheet
          sunk: "#ECE5D6", // recessed panels
          hover: "#E5DDCB", // hover states
          line: "#DDD5C2", // hairline rules
        },
        // ── Ink text ────────────────────────────────────────────────────
        ink: {
          DEFAULT: "#1B2530", // deep ink navy
          soft: "#4E5863", // secondary copy
          faint: "#8A8F8B", // captions / placeholders
          onred: "#FFF8F4", // text on the vermilion seal
        },
        // ── The "seal" accent (vermilion redaction red) ─────────────────
        seal: {
          DEFAULT: "#C13B26",
          dark: "#9E2F1D",
          soft: "#F4E0DA",
          line: "#E3B1A2",
        },
        // ── Secondary accent (institutional teal) ───────────────────────
        teal: {
          DEFAULT: "#17645B",
          dark: "#0F4A44",
          soft: "#DCEBE7",
        },
        // ── Risk semantics (tuned for light paper) ──────────────────────
        risk: {
          critical: "#B3261E",
          high: "#C0551F",
          medium: "#9A6A12",
          low: "#1E7A55",
        },
        // ── Legacy token names (remapped so the whole app re-themes) ────
        bg: {
          primary: "#F5F1E8",
          secondary: "#FCFAF5",
          tertiary: "#ECE5D6",
          hover: "#E5DDCB",
        },
        accent: {
          blue: "#C13B26", // now the vermilion seal
          cyan: "#17645B", // now the institutional teal
        },
        text: {
          primary: "#1B2530",
          secondary: "#4E5863",
          muted: "#8A8F8B",
        },
        border: "#DDD5C2",
      },
      fontFamily: {
        sans: ["'Public Sans'", "system-ui", "sans-serif"],
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(27,37,48,0.05), 0 10px 28px -12px rgba(27,37,48,0.18)",
        "card-lg":
          "0 2px 4px rgba(27,37,48,0.06), 0 24px 48px -20px rgba(27,37,48,0.28)",
        "inset-line": "inset 0 1px 0 rgba(255,255,255,0.7)",
      },
      animation: {
        "flash-red": "flashRed 0.5s ease-in-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shake: "shake 0.4s ease-in-out",
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.25s ease-out",
      },
      keyframes: {
        flashRed: {
          "0%": { backgroundColor: "rgba(193,59,38,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-6px)" },
          "75%": { transform: "translateX(6px)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
