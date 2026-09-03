/**
 * Shared app chrome for the authenticated screens — BRIEF §3 "Site header
 * (app screens)" and §2 typography.
 *
 * Every authenticated route previously carried its own copy of the same
 * `<nav className="border-b bg-white sticky top-0 z-50">` block. That markup is
 * collected here so the stadium-night header is defined once. These are
 * presentational only: no state, no data fetching, no client hooks, so they
 * stay server components and can be dropped into any page.
 */
import Link from "next/link";

import { cn } from "@/lib/utils";

/** 800/17px Archivo wordmark with the glowing red dot. */
export function Wordmark({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 font-display text-[17px] font-extrabold tracking-[-0.02em] text-foreground",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 flex-none rounded-[3px] bg-primary shadow-[0_0_12px_rgba(200,16,46,.9)]"
      />
      Bleacher Backers
    </Link>
  );
}

/** Pill identifying the org/team the screen is scoped to. */
export function TeamChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] rounded-full border border-border bg-card px-3 py-[5px] text-xs font-semibold text-foreground",
        className
      )}
    >
      <i
        aria-hidden="true"
        className="h-2 w-2 flex-none rounded-full bg-primary not-italic shadow-[0_0_10px_rgba(200,16,46,.9)]"
      />
      {children}
    </span>
  );
}

/** Red initials avatar, as used by the coach/user slot in the header. */
export function InitialsAvatar({
  initials,
  name,
  className,
}: {
  initials: string;
  /** Full name for the accessible label; falls back to the initials. */
  name?: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Signed in as ${name || initials}`}
      className={cn(
        "flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-primary font-display text-[11px] font-bold text-primary-foreground shadow-[0_0_14px_rgba(200,16,46,.55)]",
        className
      )}
    >
      <span aria-hidden="true">{initials}</span>
    </span>
  );
}

/**
 * Sticky translucent header. `left` renders beside the wordmark (team chip,
 * breadcrumb); `children` is pushed to the far right (actions, avatar).
 */
export function SiteHeader({
  left,
  children,
  sticky = true,
  className,
}: {
  left?: React.ReactNode;
  children?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "z-50 border-b border-border bg-[rgba(10,13,20,.86)] backdrop-blur-[10px]",
        sticky ? "sticky top-0" : "relative",
        className
      )}
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Wordmark />
        {left}
        {children ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Eyebrow in team red with a soft glow (BRIEF §2). "team" tone is TEXT, so
    it uses primary-300 (#F37287, ~7:1 on the night shell) — #C8102E fails AA
    at 3.3:1 and is reserved for fills/rules. */
export function Kicker({
  children,
  className,
  tone = "muted",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "muted" | "team";
}) {
  return (
    <span
      className={cn(
        "block text-[11px] font-semibold uppercase tracking-[0.16em]",
        tone === "team"
          ? "text-primary-300 [text-shadow:0_0_14px_rgba(200,16,46,.6)]"
          : "text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Page H1: heavy uppercase Archivo with the stacked red text-shadow. */
export function PageTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "font-display text-[clamp(26px,4vw,40px)] font-black uppercase leading-[1.02] tracking-[-0.02em] text-foreground",
        "[text-shadow:0_2px_0_rgba(200,16,46,.5),0_6px_0_rgba(200,16,46,.2),0_18px_44px_rgba(200,16,46,.25)]",
        className
      )}
    >
      {children}
    </h1>
  );
}

/**
 * Stat-block classes — BRIEF §3 "Stat blocks": hairline cell over a 4% white
 * wash with a deep drop shadow, 28px tabular number, 12px muted label.
 */
export const statStyles = {
  cell: "rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-center shadow-[0_10px_26px_rgba(0,0,0,.35)]",
  num: "text-[28px] font-semibold leading-tight tabular text-foreground",
  label: "mt-0.5 text-xs font-medium text-muted-foreground",
} as const;

/**
 * Roster / leaderboard / ledger table classes — BRIEF §3 "Tables".
 * `th` is a muted uppercase 11px label on a 3% wash, `td` is tabular with a
 * hairline bottom rule, and rows lift to a 4% wash on hover. Exported as plain
 * strings so each table can compose them with its own alignment utilities.
 */
export const tableStyles = {
  th: "bg-white/[0.03] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground whitespace-nowrap",
  td: "border-b border-border px-4 py-3 align-middle tabular",
  tr: "transition-colors hover:bg-white/[0.04] [&:last-child>td]:border-b-0",
} as const;

/**
 * Hero money numerals — BRIEF §2: big money is set as a display numeral
 * (Archivo 800, tabular) lifted off the page by the stacked red text-shadow.
 * Apply `MONEY_HERO_SHADOW` as an inline `textShadow`; the sizing stays with
 * the call site because each hero picks its own clamp.
 */
export const MONEY_HERO_SHADOW =
  "0 2px 0 rgba(200,16,46,.5), 0 6px 0 rgba(200,16,46,.2), 0 18px 44px rgba(200,16,46,.25)";

/**
 * Display-only whole-dollar money. Cents are noise at hero size, so they are
 * dropped here rather than by changing what any `formatCurrency` returns.
 *
 * IMPORTANT: this takes **dollars**. The repo has two `formatCurrency`
 * helpers with different units (lib/utils takes cents, lib/utils/formatters
 * takes dollars), so the unit is spelled out in the parameter name and every
 * call site converts explicitly.
 */
export function formatWholeDollars(amountInDollars: number): string {
  return `$${Math.round(amountInDollars || 0).toLocaleString("en-US")}`;
}
