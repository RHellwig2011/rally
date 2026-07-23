import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";

/**
 * About page, composed on the Bleacher Backers UI "Kinetic Site" direction:
 * left-anchored sections, Space Grotesk display type set large and tight,
 * numbered rules in place of icon chips, and an editorial story block with an
 * Instrument Serif pull quote. Content is unchanged from the original — this is
 * a recomposition, not a rewrite.
 */

const VALUES = [
  {
    n: "01",
    title: "Simplicity first",
    body: "Fundraising should be simple enough for a 12-year-old to launch a campaign. If it's complicated, we redesign it. No exceptions.",
  },
  {
    n: "02",
    title: "Trust & transparency",
    body: "Every penny is tracked. Every fee is clear. No hidden charges, no surprises. Donors and teams deserve complete transparency.",
  },
  {
    n: "03",
    title: "Kids come first",
    body: 'Every feature we build, every decision we make — we ask: "Does this help more kids participate?" If not, we don\'t do it.',
  },
];

const DIFFERENTIATORS = [
  {
    label: "Outreach",
    title: "Messages that sound like a person",
    body: "Write one note and the platform personalizes the email and texts to every contact on the roster. Send to hundreds in seconds.",
  },
  {
    label: "Banking",
    title: "Built-in, not bolted on",
    body: "Funds go directly into a secure campaign account with a running balance the whole booster board can see. No waiting, no transfers.",
  },
  {
    label: "Setup",
    title: "Live in an afternoon",
    body: "From signup to a live campaign in minutes. No approval delays, no paperwork — just a few questions and you're raising.",
  },
  {
    label: "Attribution",
    title: "Credit to the right player",
    body: "Every team member gets their own link and dashboard. See exactly who raised what, and let the friendly competition do the asking.",
  },
  {
    label: "Live",
    title: "Updates in real time",
    body: "Watch donations roll in as they happen, notify supporters, and post updates without waiting on anyone.",
  },
  {
    label: "Support",
    title: "Real humans answer",
    body: "We respond to support in hours, not days. Your season is on a deadline, and we treat it that way.",
  },
];

const STATS = [
  { v: "$2.5M+", l: "raised for teams" },
  { v: "500+", l: "programs helped" },
  { v: "15K+", l: "donors" },
  { v: "98%", l: "reach their goal", accent: true },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#101A2C] antialiased">
      <Navigation />

      {/* -------------------------------------------------------------- Hero */}
      <section className="bg-primary text-white">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 md:py-24 lg:px-16">
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-secondary-200">
            Our mission
          </p>
          <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(40px,6.5vw,84px)] font-semibold leading-[0.98] tracking-[-0.03em]">
            Fundraising shouldn't be this hard.
          </h1>
          <p className="mt-6 max-w-[52ch] text-[19px] leading-relaxed text-primary-100">
            So we built Bleacher Backers to make it ridiculously easy for youth
            teams, clubs, and school groups to raise money and get back to the
            game.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- Mission */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-16">
          <div>
            <h2 className="font-display text-[clamp(28px,4vw,46px)] font-semibold leading-[1.05] tracking-[-0.02em] text-primary">
              Every kid deserves a chance to play, learn, and grow.
            </h2>
            <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-[#5B6575]">
              <p>
                We started Bleacher Backers because we saw too many talented kids
                miss out simply because fundraising was too complicated, too slow,
                or too expensive.
              </p>
              <p>
                Traditional fundraising meant bake sales, door-to-door candy, and
                awkward asks. Coaches and parents spent evenings on spreadsheets,
                counting cash, and chasing receipts.
              </p>
              <p className="font-semibold text-[#101A2C]">There had to be a better way.</p>
              <p>
                So we built one — a modern platform that combines personalized
                outreach, secure banking, and real-time tracking to help teams
                reach their goals faster than ever.
              </p>
            </div>
          </div>

          {/* Stat panel — hairline grid, tabular figures */}
          <div className="lg:pt-2">
            <div className="rounded-[20px] border border-[#E4E8EF] bg-[#F5F7FA] p-8 sm:p-10">
              <dl className="grid grid-cols-2 gap-y-8">
                {STATS.map((s) => (
                  <div key={s.l}>
                    <dt className="sr-only">{s.l}</dt>
                    <dd
                      className={`font-display text-[clamp(28px,4vw,40px)] font-bold tabular-nums ${
                        s.accent ? "text-secondary" : "text-primary"
                      }`}
                    >
                      {s.v}
                    </dd>
                    <p className="mt-1 text-[13px] text-[#5B6575]">{s.l}</p>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Values */}
      <section className="border-y border-[#E4E8EF] bg-[#F5F7FA]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 md:py-24 lg:px-16">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-display text-[clamp(30px,4.4vw,52px)] font-semibold tracking-[-0.02em] text-primary">
              What we stand for
            </h2>
            <p className="max-w-[34ch] text-base text-[#5B6575]">
              These three tests decide what we build and what we leave out.
            </p>
          </div>
          <ol className="mt-12 grid gap-[22px] md:grid-cols-3">
            {VALUES.map((v) => (
              <li key={v.n} className="border-t-2 border-secondary pt-[22px]">
                <span className="font-display text-[15px] font-bold text-secondary">
                  {v.n}
                </span>
                <h3 className="mt-3.5 font-display text-[22px] font-semibold text-primary">
                  {v.title}
                </h3>
                <p className="mt-2.5 text-[15.5px] leading-relaxed text-[#5B6575]">
                  {v.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------- Differentiators */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 md:py-24 lg:px-16">
          <h2 className="max-w-[18ch] font-display text-[clamp(30px,4.4vw,52px)] font-semibold leading-[1.05] tracking-[-0.02em] text-primary">
            How we're different
          </h2>
          <p className="mt-4 max-w-[46ch] text-lg text-[#5B6575]">
            Not just another fundraising page — the operating system for a team's
            whole drive.
          </p>
          <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {DIFFERENTIATORS.map((d) => (
              <div key={d.title} className="border-t border-[#E4E8EF] pt-6">
                <span className="font-display text-[12px] font-bold uppercase tracking-[0.14em] text-secondary">
                  {d.label}
                </span>
                <h3 className="mt-2.5 font-display text-[20px] font-semibold text-primary">
                  {d.title}
                </h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-[#5B6575]">
                  {d.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Story */}
      <section className="bg-primary text-white">
        <div className="mx-auto max-w-[820px] px-5 py-16 sm:px-8 md:py-24 lg:px-16">
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-secondary-200">
            Our story
          </p>
          <div className="mt-7 space-y-6 text-[17px] leading-relaxed text-primary-100">
            <p>
              Bleacher Backers started when our founder, a former high school
              coach, watched talented athletes miss tournaments because their team
              couldn't raise enough money. The process was stuck in the 1990s —
              spreadsheets, cash counting, and endless phone calls.
            </p>
            <p>
              Parents were writing checks, kids were selling candy nobody wanted,
              and coaches were doing bookkeeping instead of planning practices.
            </p>
          </div>

          <blockquote className="my-10 border-l-2 border-secondary-300 pl-6">
            <p className="font-quote text-[clamp(26px,4vw,44px)] leading-[1.18] text-white">
              “There has to be a better way,” we thought. So we built it.
            </p>
          </blockquote>

          <p className="text-[17px] leading-relaxed text-primary-100">
            We combined modern fintech, thoughtful automation, and real design
            into the platform we wish we'd had on the sideline — one where:
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Campaigns launch in an afternoon, not a week",
              "Outreach writes itself, personalized per contact",
              "Every dollar is tracked transparently, in real time",
              "Banking is built in, not bolted on",
              "Players can run their own fundraising",
            ].map((line) => (
              <li key={line} className="flex gap-3 text-[16px] text-primary-100">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary-300" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-8 font-display text-[19px] font-semibold leading-snug text-white">
            Because every kid deserves a chance to play, learn, and grow —
            regardless of their family's ability to fundraise.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section className="bg-secondary">
        <div className="mx-auto max-w-[1180px] px-5 py-16 text-center sm:px-8 md:py-24 lg:px-16">
          <h2 className="font-display text-[clamp(34px,5.5vw,72px)] font-semibold leading-[1.0] tracking-[-0.02em] text-white">
            Ready to transform your fundraising?
          </h2>
          <p className="mx-auto mt-5 max-w-[44ch] text-lg text-white/80">
            Join hundreds of teams raising more, in less time, with Bleacher
            Backers.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-secondary transition-transform hover:-translate-y-0.5"
            >
              Start your campaign
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/campaigns"
              className="inline-flex items-center justify-center rounded-full border border-white/70 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              Browse campaigns
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Footer */}
      <footer className="bg-[#0A101E]">
        <div className="mx-auto max-w-[1180px] px-5 py-10 text-center text-sm text-[#66738A] sm:px-8 lg:px-16">
          <p>
            © {new Date().getFullYear()} Bleacher Backers. All rights reserved. We
            never sell or share your data.
          </p>
        </div>
      </footer>
    </div>
  );
}
