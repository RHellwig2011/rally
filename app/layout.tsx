import type { Metadata } from "next";
import { Inter, Archivo, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Atmosphere } from "@/components/atmosphere";
import { SessionKeepAlive } from "@/components/session-keep-alive";

// Type system, per the "C · Stadium" design brief (§2):
//   Archivo (600/700/800) — display/headings/numbers-as-display.
//   Inter (400/500/600)   — body copy and UI.
//   Instrument Serif (italic) — pull quotes only.
// Exposed as CSS variables so Tailwind's font-display/font-quote utilities
// can reach them (see tailwind.config.ts fontFamily).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-quote",
});

export const metadata: Metadata = {
  title: "Bleacher Backers - Fundraising Reimagined for Youth Teams",
  description:
    "Next-generation fundraising platform with integrated banking, real-time tracking, and automated outreach for youth teams, clubs, and school groups.",
  keywords: [
    "fundraising",
    "youth teams",
    "school fundraising",
    "team fundraising",
    "sports fundraising",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable} ${instrumentSerif.variable}`}
    >
      <body className={inter.className}>
        {/* Fixed floodlights / grain / red top rule behind every route. */}
        <Atmosphere />
        <SessionKeepAlive />
        {children}
      </body>
    </html>
  );
}
