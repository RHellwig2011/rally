import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
