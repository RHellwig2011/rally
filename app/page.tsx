import Link from "next/link";
import type { CSSProperties } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SportArtwork } from "@/components/SportArtwork";
import { MarketingMobileNav } from "@/components/MarketingMobileNav";
import { Wordmark } from "@/components/app-chrome";

/**
 * Marketing home page.
 *
 * "C · Stadium" treatment (.design-sync/bbc-v3/BRIEF.md §4 screens 09 and 10):
 * a jumbotron hero in Archivo where the second row is outlined rather than
 * filled, a red kicker eyebrow, the sport-name ticker, numbered section heads
 * built from an outlined numeral, and a closing CTA band. The pricing block at
 * the bottom is the one place light appears — the fee breakdown sits on a
 * `.paper-panel` document (globals.css), a printed page lying on the night.
 */

/**
 * Hero photo. To use a real team photo in the hero card: drop the file under
 * public/ (e.g. public/images/hero-team.jpg, landscape ~1200×800 or wider) and
 * set this to its path ("/images/hero-team.jpg"). It then layers over the
 * illustrated band. Left null by default so the card shows the designed
 * SportArtwork rather than a broken-image reference to a file that isn't there.
 */
const HERO_PHOTO: string | null = null;

/** BRIEF §2: red kicker/eyebrow — 600/11px Inter, wide tracking, red glow.
    Text is primary-300: #C8102E fails AA (3.3:1) at this size on the night
    shell; red stays for fills and rules. */
const KICKER =
  "font-semibold uppercase tracking-[0.18em] text-primary-300 text-[11px] sm:text-[12px]";
const KICKER_GLOW = { textShadow: "0 0 14px rgba(200,16,46,.6)" };

/** BRIEF §2: stacked red drop-shadow behind a display heading. */
const RED_STACK_SHADOW = {
  textShadow:
    "0 2px 0 rgba(200,16,46,.5), 0 6px 0 rgba(200,16,46,.2), 0 18px 44px rgba(200,16,46,.25)",
};

/** BRIEF §3 "sec-num": 700 46px Archivo drawn as an outline, not a fill.
    .outline-text keeps it visible under forced-colors (see globals.css). */
const SEC_NUM =
  "outline-text font-display text-[38px] font-bold leading-none tracking-[-0.02em] sm:text-[46px]";
const SEC_NUM_STROKE = { "--outline-stroke": "1.5px #8B93A3" } as CSSProperties;

/** Uppercase H2 that sits beside an outlined numeral. */
const SEC_H2 =
  "font-display text-[clamp(28px,4.5vw,52px)] font-extrabold uppercase leading-[1] tracking-[-0.02em] text-foreground";

const SPORTS = [
  "BASKETBALL",
  "TRACK & FIELD",
  "SOCCER",
  "SWIM",
  "VOLLEYBALL",
  "WRESTLING",
  "BASEBALL",
  "LACROSSE",
  "CROSS COUNTRY",
  "SOFTBALL",
];

const STEPS = [
  {
    n: "01",
    title: "Set the goal",
    body: "Add your roster, set a target, and go live on a page that looks like your program — colors, logo, and all.",
  },
  {
    n: "02",
    title: "Let it do the asking",
    body: "Every player gets their own link. Write once and the platform personalizes the email and texts to every contact.",
  },
  {
    n: "03",
    title: "Spend it when you need it",
    body: "Funds land in an account the whole booster board can see. Every dollar in and out is on the ledger.",
  },
];

/**
 * Deliberately claims rather than counts. The platform is new; a metric row
 * here would have to be fabricated, so it states what the product does instead.
 */
const VALUE_PROPS = [
  {
    head: "Built for teams of every size",
    body: "A ten-swimmer club and a 60-player football program run the same drive.",
  },
  {
    head: "Every dollar accounted for",
    body: "Fees are shown before the gift and each move is on the ledger after it.",
  },
  {
    head: "No setup fee, no contract",
    body: "You pay a percentage of what you raise. Raise nothing, pay nothing.",
  },
];

const CAPABILITIES = [
  {
    label: "Outreach",
    title: "Messages that sound like a person",
    body: "Draft one note and send it to every contact on the roster, personalized per player, over email and SMS together.",
  },
  {
    label: "Banking",
    title: "A ledger parents can audit",
    body: "Integrated accounts with a running balance, disbursement approvals, and a transaction history nobody has to take on faith.",
  },
  {
    label: "Attribution",
    title: "Credit to the right player",
    body: "Every donation traces to the player who earned it, so leaderboards and season totals are never guesswork.",
  },
  {
    label: "Payouts",
    title: "Money out in one click",
    body: "Request a disbursement, get it approved, and move funds to the program's account without a treasurer's spreadsheet.",
  },
];

/**
 * Pricing tiers. There is only one rate, so these state the whole schedule
 * rather than pretending to be a good/better/best ladder.
 */
const PRICING_LINES = [
  {
    label: "Platform fee",
    figure: "10%",
    body: "Charged only on money you actually raise. Unlimited players, pages, outreach, and payouts are all inside it.",
    accent: true,
  },
  {
    label: "Card processing",
    figure: "2.9% + 30¢",
    body: "What the card networks charge, passed through per gift. We add nothing on top of it.",
    accent: false,
  },
  {
    label: "Everything else",
    figure: "$0",
    body: "No setup fee, no monthly minimum, no per-seat charge, no contract. Raise nothing and you pay nothing.",
    accent: false,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      {/* ---------------------------------------------------------------- Nav */}
      {/* BRIEF §3 "Site header": translucent night bar over a blur, hairline
          bottom rule. Sits under the fixed red top rule from <Atmosphere />. */}
      <header className="sticky top-0 z-50 border-b border-border bg-[rgba(10,13,20,.86)] backdrop-blur-[10px]">
        <div className="relative mx-auto flex h-[66px] max-w-[1180px] items-center gap-8 px-5 sm:px-8 lg:px-16">
          <Wordmark />
          <nav className="ml-2 hidden gap-7 md:flex">
            <a href="#how" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              How it works
            </a>
            <Link href="/campaigns" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Campaigns
            </Link>
            <a href="#platform" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Platform
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="flex-1" />
          <Link
            href="/login"
            className="hidden whitespace-nowrap text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground md:inline"
          >
            Sign in
          </Link>
          <Button asChild className="hidden md:inline-flex">
            <Link href="/signup">Start a campaign</Link>
          </Button>
          <MarketingMobileNav />
        </div>
      </header>

      {/* -------------------------------------------------------------- Hero */}
      {/* BRIEF §4 screen 09: jumbotron. Huge uppercase Archivo, second row
          outlined with -webkit-text-stroke rather than filled, red glow behind
          the filled row. */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-44 h-[420px] w-[420px] rounded-full opacity-70 blur-[10px]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(200,16,46,.25), transparent)",
          }}
        />
        <div className="mx-auto max-w-[1180px] px-5 pb-14 pt-14 sm:px-8 md:pt-20 lg:px-16 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="relative">
              <p className={KICKER} style={KICKER_GLOW}>
                Youth sports fundraising
              </p>
              <h1
                className="mt-4 font-display text-[clamp(52px,8.5vw,104px)] font-extrabold uppercase leading-[0.92] tracking-[-0.03em] text-foreground"
                style={RED_STACK_SHADOW}
              >
                Fund the
                <span
                  className="outline-text block"
                  style={{
                    "--outline-stroke": "2px #EEF1F6",
                    textShadow: "none",
                  } as CSSProperties}
                >
                  season.
                </span>
              </h1>
              <p className="mt-7 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
                One place to run the whole drive — personalized outreach to every
                contact on the roster, a ledger the booster board can audit, and
                payouts the week the team actually needs them.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/signup">Start a campaign</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#how">See how it works</a>
                </Button>
              </div>
              <p className="mt-5 text-[13px] text-muted-foreground">
                No setup fee. No contract. Raise nothing and you pay nothing.
              </p>
            </div>

            {/*
              Product visualization: a campaign page reduced to the three things
              that actually matter to a donor — who is asking, how far along they
              are, and where the money goes. Static by design; this is marketing
              chrome, not live data.
            */}
            <div className="relative lg:pl-4">
              <div
                aria-hidden
                className="absolute -inset-x-4 -inset-y-6 rounded-[28px] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_14px)]"
              />
              <Card className="relative">
                {/* Photo band. The illustrated artwork always fills the band;
                    a real team photo (HERO_PHOTO) layers on top when present and
                    reveals the artwork again if the file is missing. */}
                <div className="relative h-44">
                  <SportArtwork
                    seed="Lincoln High Varsity Basketball"
                    category="SPORTS"
                  />
                  {HERO_PHOTO ? (
                    <img
                      src={HERO_PHOTO}
                      alt="A youth sports team"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-[#12161F] via-transparent to-transparent"
                  />
                  <span className="absolute left-4 top-5 rounded-full border border-white/10 bg-[rgba(10,13,20,.7)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-300 backdrop-blur-sm">
                    Basketball
                  </span>
                </div>

                <CardContent className="p-6 pt-6">
                  <div>
                    <h2 className="font-display text-[20px] font-bold uppercase tracking-[-0.01em] text-foreground">
                      Lincoln High Varsity
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Spring tournament travel &amp; new uniforms
                    </p>
                  </div>

                  <div className="mt-6 flex items-baseline justify-between">
                    <span className="font-display text-[32px] font-extrabold tabular tracking-[-0.02em] text-foreground">
                      $6,240
                    </span>
                    <span className="text-[13px] tabular text-muted-foreground">
                      of $10,000
                    </span>
                  </div>
                  <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[62%] rounded-full bg-secondary shadow-glow-accent" />
                  </div>

                  <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                    {[
                      { n: "Marcus R.", a: "$250", t: "2m ago" },
                      { n: "The Delgado family", a: "$100", t: "18m ago" },
                      { n: "Anonymous", a: "$45", t: "1h ago" },
                    ].map((d) => (
                      <div key={d.n} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] font-display text-[11px] font-bold text-foreground">
                            {d.n.charAt(0)}
                          </span>
                          <span className="text-foreground">{d.n}</span>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span className="font-semibold tabular text-secondary">
                            {d.a}
                          </span>
                          <span className="w-14 text-right text-xs tabular text-muted-foreground">
                            {d.t}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/*
            Value props, not metrics. The numbers that used to sit here were
            invented; nothing in the product backs them, so they're gone rather
            than restated with a smaller figure.
          */}
          <dl className="mt-14 grid gap-6 divide-y divide-white/10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-y-0">
            {VALUE_PROPS.map((v, i) => (
              <div
                key={v.head}
                className={`pt-6 sm:pt-0 ${i === 0 ? "sm:pr-5 lg:pr-10" : "sm:px-5 lg:px-10"}`}
              >
                <dt className="font-display text-[clamp(17px,3.2vw,20px)] font-bold uppercase tracking-[-0.01em] text-foreground">
                  {v.head}
                </dt>
                <dd className="mt-2 text-[14px] leading-snug text-muted-foreground">
                  {v.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ----------------------------------------------------------- Marquee */}
      {/* BRIEF §3 "Ticker": hairline strip, Archivo caps on the track, red dots
          between items. The track renders SPORTS twice so translateX(-50%)
          loops seamlessly — see the `marquee` keyframe in tailwind.config. */}
      <div className="overflow-hidden border-y border-white/10 bg-white/[0.02] py-[13px]">
        {/* No `gap` on the track: a -50% loop must translate exactly one
            sequence. Spacing lives on the items (pr) so the two halves are
            identical width — with a track gap the loop snaps 17px per cycle. */}
        <div className="flex w-max animate-marquee font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground motion-reduce:animate-none">
          {[...SPORTS, ...SPORTS].map((s, i) => (
            <span
              key={i}
              // The second pass exists only so the loop reads as continuous.
              aria-hidden={i >= SPORTS.length}
              className="flex items-center gap-[34px] whitespace-nowrap pr-[34px]"
            >
              {s}
              <span
                aria-hidden
                className="h-[6px] w-[6px] rounded-full bg-primary shadow-glow-team"
              />
            </span>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------- How it works */}
      <section id="how">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 md:py-20 lg:px-16 lg:py-24">
          <div className="flex flex-wrap items-baseline justify-between gap-6">
            <div className="flex items-baseline gap-4">
              <span aria-hidden className={SEC_NUM} style={SEC_NUM_STROKE}>
                01
              </span>
              <h2 className={SEC_H2}>
                Live in an afternoon.
                <br />
                Funded all season.
              </h2>
            </div>
            <p className="max-w-[34ch] text-[15px] leading-relaxed text-muted-foreground">
              No setup fees and no contracts — just a clean way to rally a
              community around a roster.
            </p>
          </div>
          <ol className="mt-12 grid gap-[22px] md:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="rounded-card border border-white/10 bg-[linear-gradient(160deg,#181E2A,#12161F)] p-6 shadow-card"
              >
                {/* BRIEF §4 screen 03 "step-num": outlined numeral, red stroke. */}
                <span
                  aria-hidden
                  className="outline-text font-display text-[34px] font-extrabold leading-none"
                  style={{ "--outline-stroke": "1.5px #C8102E" } as CSSProperties}
                >
                  {s.n}
                </span>
                <h3 className="mt-4 font-display text-[20px] font-bold uppercase tracking-[-0.01em] text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- Capabilities */}
      <section
        id="platform"
        className="border-t border-white/10 bg-white/[0.02]"
      >
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 md:py-20 lg:px-16 lg:py-24">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-4">
              <span aria-hidden className={SEC_NUM} style={SEC_NUM_STROKE}>
                02
              </span>
              <h2 className={SEC_H2}>Everything the drive needs</h2>
            </div>
            <Link
              href="/about"
              className="border-b-[1.5px] border-primary pb-1 text-[15px] font-semibold text-foreground transition-colors hover:text-primary"
            >
              Why we built it →
            </Link>
          </div>
          <div className="mt-11 grid gap-[22px] sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <div
                key={c.label}
                className="rounded-card border border-white/10 bg-[linear-gradient(165deg,#1B2334,#121826)] p-7 shadow-card transition-transform duration-200 ease-spring hover:-translate-y-1"
              >
                <span
                  className="font-semibold uppercase tracking-[0.18em] text-primary-300 text-[11px]"
                  style={KICKER_GLOW}
                >
                  {c.label}
                </span>
                <h3 className="mt-3 font-display text-[21px] font-bold uppercase tracking-[-0.01em] text-foreground">
                  {c.title}
                </h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Pull quote */}
      <section className="relative overflow-hidden border-t border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[860px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(closest-side, rgba(200,16,46,.18), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-[1000px] px-5 py-16 text-center sm:px-8 md:py-24 lg:px-16 lg:py-[110px]">
          <p className={KICKER} style={KICKER_GLOW}>
            Why it works
          </p>
          <p className="mt-7 font-quote text-[clamp(28px,4.6vw,52px)] leading-[1.16] text-foreground">
            People give when they can see where the money goes.
          </p>
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Every donation · every fee · every payout · on one ledger
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------- Pricing */}
      {/* BRIEF §4 screen 10: night tier cards, then the fee itemization on an
          embedded light document (.paper-panel in globals.css). */}
      <section id="pricing" className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 md:py-20 lg:px-16 lg:py-24">
          <div className="flex items-baseline gap-4">
            <span aria-hidden className={SEC_NUM} style={SEC_NUM_STROKE}>
              03
            </span>
            <div>
              <p className={KICKER} style={KICKER_GLOW}>
                Pricing
              </p>
              <h2 className={`${SEC_H2} mt-3`}>
                Ten percent.
                <br />
                That&apos;s the whole page.
              </h2>
            </div>
          </div>
          <p className="mt-6 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
            No setup fee, no monthly minimum, no per-seat charge. The platform
            fee and card processing are the only two lines, and both are shown to
            every donor before they give.
          </p>

          <div className="mt-11 grid gap-[22px] md:grid-cols-3">
            {PRICING_LINES.map((tier) => (
              <div
                key={tier.label}
                className={`relative overflow-hidden rounded-card border p-7 shadow-card ${
                  tier.accent
                    ? "border-primary/60 bg-[linear-gradient(165deg,#241420,#121826)]"
                    : "border-white/10 bg-[linear-gradient(165deg,#1B2334,#121826)]"
                }`}
              >
                {tier.accent && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[3px] bg-primary shadow-[0_0_12px_#C8102E]"
                  />
                )}
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {tier.label}
                </p>
                <p
                  className={`mt-3 font-display text-[38px] font-extrabold tabular leading-none tracking-[-0.02em] ${
                    tier.accent ? "text-primary" : "text-foreground"
                  }`}
                  style={tier.accent ? KICKER_GLOW : undefined}
                >
                  {tier.figure}
                </p>
                <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
                  {tier.body}
                </p>
              </div>
            ))}
          </div>

          {/* The paper document. Light tokens are scoped to .paper-panel — this
              is a printed page lying on the night shell, not a theme flip. */}
          <div className="mt-16 flex justify-center">
            <div className="paper-panel w-full max-w-[720px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] paper-muted">
                The paper trail · print this for your booster board
              </p>
              <h3 className="mt-3 font-display text-[clamp(22px,4vw,32px)] font-extrabold uppercase leading-none tracking-[-0.02em]">
                What a $100 gift becomes
              </h3>
              <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed paper-muted">
                The same arithmetic the donor sees under the donate button,
                itemized the way it will appear in your payout ledger.
              </p>

              <div className="paper-ledger">
                <div className="paper-row">
                  <span>Donor gives</span>
                  <span>$100.00</span>
                </div>
                <div className="paper-row is-negative">
                  <span>Platform fee (10%)</span>
                  <span>−$10.00</span>
                </div>
                <div className="paper-row is-negative">
                  <span>Card processing (2.9% + 30¢)</span>
                  <span>−$3.20</span>
                </div>
                <div className="paper-row is-total">
                  <span>Your team keeps</span>
                  <span>$86.80</span>
                </div>
                <div className="paper-row is-compare">
                  <span>On a $500 gift, your team keeps</span>
                  <span>$435.20</span>
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed paper-muted">
                Larger gifts keep a larger share — processing is a flat 30¢ plus
                a percentage, so a $500 donation nets 87%.
              </p>
              <span className="paper-stamp">No setup fee · no contract</span>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      {/* BRIEF §4 screen 09 "ctaband": red glow behind a stacked-shadow H2. */}
      <section className="relative overflow-hidden border-t border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(closest-side, rgba(200,16,46,.22), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-[1180px] px-5 py-16 text-center sm:px-8 md:py-24 lg:px-16 lg:py-[110px]">
          <h2
            className="font-display text-[clamp(38px,7vw,72px)] font-extrabold uppercase leading-[0.98] tracking-[-0.03em] text-foreground"
            style={{
              textShadow:
                "0 4px 0 rgba(200,16,46,.35), 0 20px 60px rgba(0,0,0,.6)",
            }}
          >
            Back a team.
            <br />
            Change a season.
          </h2>
          <p className="mx-auto mt-6 max-w-[44ch] text-[15px] leading-relaxed text-muted-foreground">
            Every season funded is a promise kept to a kid who just wants to
            play.
          </p>
          <Button asChild size="lg" className="mt-9">
            <Link href="/signup">Start a campaign</Link>
          </Button>
        </div>
      </section>

      {/* -------------------------------------------------------------- Footer */}
      <footer className="border-t border-white/10 bg-white/[0.02] text-muted-foreground">
        <div className="mx-auto max-w-[1180px] px-5 pb-10 pt-12 sm:px-8 md:pt-16 lg:px-16 lg:pt-20">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <p className="flex items-center gap-2 font-display text-[17px] font-extrabold tracking-[-0.02em] text-foreground">
                <span
                  aria-hidden
                  className="h-[9px] w-[9px] rounded-full bg-primary shadow-glow-team"
                />
                Bleacher&nbsp;Backers
              </p>
              <p className="mt-3.5 max-w-[30ch] text-sm leading-relaxed">
                Fundraising built for boosters, coaches, and the whole town.
              </p>
            </div>
            {[
              {
                head: "Product",
                links: [
                  { label: "How it works", href: "#how" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Browse campaigns", href: "/campaigns" },
                ],
              },
              {
                head: "Company",
                links: [
                  { label: "About", href: "/about" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                ],
              },
              {
                head: "Support",
                links: [
                  { label: "Help Center", href: "/help" },
                  { label: "Contact us", href: "/help" },
                ],
              },
            ].map((col) => (
              <div key={col.head}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {col.head}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-11 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 text-[13px]">
            <span>© {new Date().getFullYear()} Bleacher Backers. All rights reserved.</span>
            <span>We never sell or share your data.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
