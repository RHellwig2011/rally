import type { Metadata } from "next";
import { Inter, Space_Grotesk, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Type system, per the "Bleacher Backers UI" design system:
//   Space Grotesk  — display/headings. Geometric and slightly athletic.
//   Inter          — body copy and UI.
//   Instrument Serif (italic) — pull quotes only.
// Exposed as CSS variables so Tailwind's font-display/font-serif utilities
// can reach them (see tailwind.config.ts fontFamily).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${instrumentSerif.variable}`}
    >
      <body className={inter.className}>{children}</body>
    </html>
  );
}
