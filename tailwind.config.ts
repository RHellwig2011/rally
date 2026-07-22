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
        // Brand scales — Bleacher Backers UI, "Navy / Gray / Dark-Green".
        // Source: Claude Design project "Bleacher Backers UI",
        // templates/palette-navy-gray-green. Tailwind compiles these into
        // literal utility classes, so they cannot be driven by the CSS
        // variables in app/globals.css — the two must be kept in sync by hand.
        primary: {
          DEFAULT: "#234C93", // Navy — brand / primary actions
          50: "#EEF3FB",
          100: "#D6E2F4",
          200: "#AEC4E6",
          300: "#7FA0CE",
          400: "#4E71AE",
          500: "#234C93",
          600: "#1D3F7C",
          700: "#173366",
          800: "#122952",
          900: "#0E1F3F",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#15613F", // Dark green — secondary accent
          50: "#E8F4EE",
          100: "#C9E7D8",
          200: "#9BD3BB",
          300: "#5DB58C",
          400: "#2E8E62",
          500: "#15613F",
          600: "#124E33",
          700: "#0E3F2A",
          800: "#0B3221",
          900: "#08251A",
          // Flipped from #1F2937 to white: the secondary surface is now dark
          // green, so dark text on it would fail contrast.
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "#1C7A50",
          light: "#DCF1E7",
          600: "#166847",
          // `dark` is not in the design-system spec, but ~17 call sites use
          // text-success-dark / bg-success-dark. Dropping the key would make
          // Tailwind silently emit no class at all, so it is retained here and
          // set to the spec's own 600 value to stay on-palette.
          dark: "#166847",
          foreground: "#FFFFFF",
        },
        // Red is danger-only and deliberately unchanged by the recolor.
        // light/dark are retained for the same reason as success.dark above.
        warning: {
          DEFAULT: "#EF4444",
          light: "#FEE2E2",
          dark: "#991B1B",
          foreground: "#FFFFFF",
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-in",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
