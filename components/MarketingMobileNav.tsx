"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS: Array<{ label: string; href: string }> = [
  { label: "How it works", href: "#how" },
  { label: "Campaigns", href: "/campaigns" },
  { label: "Platform", href: "#platform" },
  { label: "Pricing", href: "#pricing" },
  { label: "Sign in", href: "/login" },
];

/**
 * Below md the marketing nav collapses to a disclosure. The desktop links live
 * in app/page.tsx and are hidden at the same breakpoint this appears at, so
 * exactly one of the two is ever visible.
 */
export function MarketingMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="marketing-mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          id="marketing-mobile-menu"
          className="absolute inset-x-0 top-[66px] border-b border-border bg-[rgba(10,13,20,.96)] px-5 pb-5 pt-2 backdrop-blur-[10px] sm:px-8"
        >
          <nav className="flex flex-col">
            {LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-white/10 py-3 text-[15px] text-muted-foreground transition-colors last:border-0 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="mt-4 rounded-lg bg-primary px-[18px] py-3 text-center text-sm font-semibold text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,.12)_inset,0_8px_24px_rgba(200,16,46,.4)]"
            >
              Start a campaign
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}

export default MarketingMobileNav;
