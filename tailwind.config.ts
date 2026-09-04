import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Reads the CSS variables already defined in app/globals.css, so it is
        // dark-mode aware. Without this registration Tailwind never emits
        // text-destructive/bg-destructive and the destructive variants of
        // Alert and Toast render with no styling at all.
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Brand scales — Bleacher Backers UI, "C · Stadium".
        // Source: .design-sync/bbc-v3/BRIEF.md (§1 canonical night palette).
        // Tailwind compiles these into literal utility classes, so they cannot
        // be driven by the CSS variables in app/globals.css — the two must be
        // kept in sync by hand.
        primary: {
          DEFAULT: "#C8102E", // Team red — brand / primary actions / top rules
          50: "#FDECEF",
          100: "#FCD5DB",
          200: "#F8AAB7",
          300: "#F37287",
          400: "#EE2F4F",
          500: "#C8102E",
          600: "#AA0E28",
          700: "#890B20",
          800: "#6D0919",
          900: "#500713",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#22C48B", // Accent green — money-positive / secondary accent
          50: "#EEFCF7",
          100: "#D4F7EB",
          200: "#ADF0D9",
          300: "#74E6BF",
          400: "#40DDA6",
          500: "#22C48B",
          600: "#1DA575",
          700: "#17825D",
          800: "#12684A",
          900: "#0E4E38",
          // Dark ink on the bright accent green: white-on-#22C48B is ~2:1 and
          // fails AA, so the foreground flips to the deep end of the ramp.
          foreground: "#06231A",
        },
        success: {
          DEFAULT: "#22C48B",
          // The night shell inverts what "light" and "dark" mean for these
          // compat keys: `light` is the soft *background* tint and `dark` is
          // the *text* colour drawn on it. On a dark page that means light =
          // rgba(34,196,139,.08) over #0A0D14, and dark = the bright glowing
          // total colour #3ECF9C from the brief. The ~29 existing
          // bg-success-light / text-success-dark pairs stay legible.
          light: "#0C1C1E",
          600: "#1DA575",
          // `dark` is not in the design-system spec, but ~15 call sites use
          // text-success-dark. Dropping the key would make Tailwind silently
          // emit no class at all, so it is retained.
          dark: "#3ECF9C",
          foreground: "#06231A",
        },
        // Warning is the brief's error/danger red (#F2614B). Same
        // light-is-background / dark-is-text inversion as success above.
        warning: {
          DEFAULT: "#F2614B",
          light: "#1D1418",
          dark: "#F27B72",
          // Dark ink on the bright error red: white-on-#F2614B is 3.19:1 and
          // fails AA for button labels; #2A0A06 is ~10:1.
          foreground: "#2A0A06",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      // Type system from the design system. font-sans stays the default body
      // face; font-display is the geometric heading face; font-quote is used
      // only for pull quotes.
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "sans-serif"],
        quote: ["var(--font-quote)", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // BRIEF §1: cards 14-16px, controls 10px (--radius), pills 999px.
        card: "14px",
      },
      // BRIEF §1 easing: standard ease and the spring used by hovers/presses.
      transitionTimingFunction: {
        stadium: "cubic-bezier(0.22, 0.8, 0.3, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      boxShadow: {
        // BRIEF §3: the signature night-card lift, and the two brand glows.
        card: "0 20px 50px rgba(0, 0, 0, 0.5)",
        sheet: "0 30px 70px rgba(0, 0, 0, 0.55)",
        "glow-team": "0 0 18px rgba(200, 16, 46, 0.5)",
        "glow-accent": "0 0 12px rgba(34, 196, 139, 0.7)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        // Sport-name ticker on the marketing page. The track renders its items
        // twice, so translating exactly -50% loops seamlessly.
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-in",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        marquee: "marquee 34s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
