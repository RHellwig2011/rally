import Link from "next/link";
import { SportArtwork } from "@/components/SportArtwork";
import { MarketingMobileNav } from "@/components/MarketingMobileNav";

/**
 * Marketing home page.
 *
 * Follows the "Kinetic Site" direction from the Bleacher Backers UI design
 * system: Space Grotesk display type set tight and large, a left-anchored hero
 * rather than a centered stack, an uppercase tracked eyebrow in the green
 * accent, hairline-divided stat rows, numbered rules instead of icon chips, and
 * full-bleed navy/green bands to break the page into movements.
 */

/**
 * Hero photo. To use a real team photo in the hero card: drop the file under
 * public/ (e.g. public/images/hero-team.jpg, landscape ~1200×800 or wider) and
 * set this to its path ("/images/hero-team.jpg"). It then layers over the
 * illustrated band. Left null by default so the card shows the designed
 * SportArtwork rather than a broken-image reference to a file that isn't there.
 */
const HERO_PHOTO: string | null = null;

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

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#101A2C] antialiased">
      {/* ---------------------------------------------------------------- Nav */}
      <header className="sticky top-0 z-50 border-b border-[#E4E8EF] bg-[#F5F7FA]/85 backdrop-blur">
        <div className="relative mx-auto flex h-[66px] max-w-[1180px] items-center gap-8 px-5 sm:px-8 lg:px-16">
          <Link
            href="/"
            className="font-display text-[18px] font-bold tracking-[-0.01em] text-primary"
          >
            Bleacher&nbsp;Backers
          </Link>
          <nav className="ml-2 hidden gap-7 md:flex">
            <a href="#how" className="text-[15px] text-[#5B6575] transition-colors hover:text-primary">
              How it works
            </a>
            <Link href="/campaigns" className="text-[15px] text-[#5B6575] transition-colors hover:text-primary">
              Campaigns
            </Link>
            <a href="#platform" className="text-[15px] text-[#5B6575] transition-colors hover:text-primary">
              Platform
            </a>
            <a href="#pricing" className="text-[15px] text-[#5B6575] transition-colors hover:text-primary">
              Pricing
            </a>
          </nav>
          <div className="flex-1" />
          <Link
            href="/login"
            className="hidden whitespace-nowrap text-[15px] font-semibold text-[#5B6575] transition-colors hover:text-primary md:inline"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="hidden whitespace-nowrap rounded-lg bg-primary px-[18px] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 md:inline-block"
          >
            Start a campaign
          </Link>
          <MarketingMobileNav />
        </div>
      </header>

      {/* -------------------------------------------------------------- Hero */}
      <section className="mx-auto max-w-[1180px] px-5 pb-8 pt-14 sm:px-8 md:pt-24 lg:px-16 lg:pt-[120px]">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-secondary">
              Youth sports fundraising
            </p>
            <h1 className="mt-[18px] font-display text-[clamp(46px,7.5vw,96px)] font-semibold leading-[0.96] tracking-[-0.03em] text-primary">
              Fund the
              <br />
              <span className="text-secondary">season.</span>
            </h1>
            <p className="mt-7 max-w-[46ch] text-[19px] leading-relaxed text-[#5B6575]">
              One place to run the whole drive — personalized outreach to every
              contact on the roster, a ledger the booster board can audit, and
              payouts the week the team actually needs them.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="rounded-[10px] bg-secondary px-7 py-4 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5"
              >
                Start a campaign
              </Link>
              <a
                href="#how"
                className="border-b-[1.5px] border-primary-100 pb-1 text-[15px] font-semibold text-primary"
              >
                See how it works →
              </a>
            </div>
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
              className="absolute -inset-x-4 -inset-y-6 rounded-[28px] bg-[repeating-linear-gradient(135deg,rgba(35,76,147,0.05)_0_1px,transparent_1px_14px)]"
            />
            <div className="relative overflow-hidden rounded-[20px] border border-[#E4E8EF] bg-white shadow-[0_30px_60px_-30px_rgba(16,24,40,0.28)]">
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
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-secondary backdrop-blur-sm">
                  Basketball
                </span>
              </div>

              <div className="p-6">
              <div>
                <h2 className="font-display text-[20px] font-semibold text-primary">
                  Lincoln High Varsity
                </h2>
                <p className="mt-1 text-sm text-[#5B6575]">
                  Spring tournament travel &amp; new uniforms
                </p>
              </div>

              <div className="mt-6 flex items-baseline justify-between">
                <span className="font-display text-[30px] font-bold tabular-nums text-[#101A2C]">
                  $6,240
                </span>
                <span className="text-[13px] text-[#5B6575]">of $10,000</span>
              </div>
              <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#EAEDF2]">
                <div className="h-full w-[62%] rounded-full bg-secondary" />
              </div>

              <div className="mt-6 space-y-3 border-t border-[#E4E8EF] pt-5">
                {[
                  { n: "Marcus R.", a: "$250", t: "2m ago" },
                  { n: "The Delgado family", a: "$100", t: "18m ago" },
                  { n: "Anonymous", a: "$45", t: "1h ago" },
                ].map((d) => (
                  <div key={d.n} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 font-display text-[11px] font-bold text-primary">
                        {d.n.charAt(0)}
                      </span>
                      <span className="text-[#101A2C]">{d.n}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="font-semibold tabular-nums text-[#101A2C]">
                        {d.a}
                      </span>
                      <span className="w-14 text-right text-xs text-[#5B6575]">
                        {d.t}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
        </div>

        {/*
          Value props, not metrics. The numbers that used to sit here were
          invented; nothing in the product backs them, so they're gone rather
          than restated with a smaller figure.
        */}
        <dl className="mt-14 grid gap-6 divide-y divide-[#E4E8EF] sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-y-0">
          {VALUE_PROPS.map((v, i) => (
            <div
              key={v.head}
              className={`pt-6 sm:pt-0 ${i === 0 ? "sm:pr-5 lg:pr-10" : "sm:px-5 lg:px-10"}`}
            >
              <dt className="font-display text-[clamp(18px,3.4vw,21px)] font-semibold text-primary">
                {v.head}
              </dt>
              <dd className="mt-1.5 text-[14px] leading-snug text-[#5B6575]">
                {v.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ----------------------------------------------------------- Marquee */}
      <div className="overflow-hidden border-y border-[#E4E8EF] py-[15px]">
        <div className="flex w-max animate-marquee gap-[34px] font-display text-[15px] font-semibold tracking-[0.02em] text-[#5B6575] motion-reduce:animate-none">
          {[...SPORTS, ...SPORTS].map((s, i) => (
            <span
              key={i}
              // The second pass exists only so the loop reads as continuous.
              aria-hidden={i >= SPORTS.length}
              className="flex items-center gap-[34px] whitespace-nowrap"
            >
              {s}
              <span className="text-secondary" aria-hidden>
                ●
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------- How it works */}
      <section id="how" className="bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 md:py-20 lg:px-16 lg:py-24">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-display text-[clamp(30px,4.4vw,52px)] font-semibold leading-[1.05] tracking-[-0.02em] text-primary">
              Live in an afternoon.
              <br />
              Funded all season.
            </h2>
            <p className="max-w-[34ch] text-base text-[#5B6575]">
              No setup fees and no contracts — just a clean way to rally a
              community around a roster.
            </p>
          </div>
          <ol className="mt-12 grid gap-[22px] md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="border-t-2 border-secondary pt-[22px]">
                <span className="font-display text-[15px] font-bold text-secondary">
                  {s.n}
                </span>
                <h3 className="mt-3.5 font-display text-[22px] font-semibold text-primary">
                  {s.title}
                </h3>
                <p className="mt-2.5 text-[15.5px] leading-relaxed text-[#5B6575]">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- Capabilities */}
      <section id="platform" className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 md:py-20 lg:px-16 lg:py-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-[clamp(30px,4.4vw,52px)] font-semibold tracking-[-0.02em] text-primary">
            Everything the drive needs
          </h2>
          <Link
            href="/about"
            className="border-b-[1.5px] border-primary-100 pb-1 text-[15px] font-semibold text-primary"
          >
            Why we built it →
          </Link>
        </div>
        <div className="mt-11 grid gap-[22px] sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <div
              key={c.label}
              className="rounded-[18px] border border-[#E4E8EF] bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_50px_-26px_rgba(16,24,40,0.3)]"
            >
              <span className="font-display text-[12px] font-bold uppercase tracking-[0.14em] text-secondary">
                {c.label}
              </span>
              <h3 className="mt-3 font-display text-[21px] font-semibold text-primary">
                {c.title}
              </h3>
              <p className="mt-2.5 text-[15.5px] leading-relaxed text-[#5B6575]">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- Pull quote */}
      <section className="bg-primary text-white">
        <div className="mx-auto max-w-[1000px] px-5 py-16 text-center sm:px-8 md:py-24 lg:px-16 lg:py-[110px]">
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-secondary-300">
            Why it works
          </p>
          <p className="mt-7 font-quote text-[clamp(28px,4.6vw,52px)] leading-[1.16] text-white">
            People give when they can see where the money goes.
          </p>
          <p className="mt-7 font-mono text-xs tracking-[0.1em] text-white/60">
            EVERY DONATION · EVERY FEE · EVERY PAYOUT · ON ONE LEDGER
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------- Pricing */}
      <section id="pricing" className="bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 md:py-20 lg:px-16 lg:py-24">
          <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <p className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-secondary">
                Pricing
              </p>
              <h2 className="mt-3.5 font-display text-[clamp(30px,4.4vw,52px)] font-semibold leading-[1.05] tracking-[-0.02em] text-primary">
                Ten percent.
                <br />
                That's the whole page.
              </h2>
              <p className="mt-5 max-w-[40ch] text-base leading-relaxed text-[#5B6575]">
                No setup fee, no monthly minimum, no per-seat charge. The
                platform fee and card processing are the only two lines, and
                both are shown to every donor before they give.
              </p>
            </div>

            <div className="rounded-[18px] border border-[#E4E8EF] bg-[#F5F7FA] p-7 sm:p-9">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#5B6575]">
                On a $100 donation
              </p>
              <dl className="mt-5 space-y-3 text-[15px] tabular-nums">
                <div className="flex justify-between">
                  <dt className="text-[#5B6575]">Donor gives</dt>
                  <dd className="font-semibold text-[#101A2C]">$100.00</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#5B6575]">Platform fee (10%)</dt>
                  <dd className="text-[#5B6575]">−$10.00</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#5B6575]">Card processing (2.9% + 30¢)</dt>
                  <dd className="text-[#5B6575]">−$3.20</dd>
                </div>
                <div className="flex justify-between border-t border-[#E4E8EF] pt-3.5">
                  <dt className="font-display font-semibold text-primary">
                    Your team keeps
                  </dt>
                  <dd className="font-display text-[22px] font-bold text-secondary">
                    $86.80
                  </dd>
                </div>
              </dl>
              <p className="mt-5 text-[13px] leading-relaxed text-[#5B6575]">
                Larger gifts keep a larger share — processing is a flat 30¢ plus
                a percentage, so a $500 donation nets 87%.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      <section className="bg-secondary">
        <div className="mx-auto max-w-[1180px] px-5 py-16 text-center sm:px-8 md:py-24 lg:px-16 lg:py-[110px]">
          <h2 className="font-display text-[clamp(40px,7vw,92px)] font-semibold leading-[0.98] tracking-[-0.03em] text-white">
            Back a team.
            <br />
            Change a season.
          </h2>
          <p className="mx-auto mt-6 max-w-[44ch] text-lg leading-relaxed text-white/80">
            Every season funded is a promise kept to a kid who just wants to
            play.
          </p>
          <Link
            href="/signup"
            className="mt-9 inline-block rounded-full bg-white px-9 py-4 text-base font-bold text-secondary transition-transform hover:-translate-y-0.5"
          >
            Start a campaign
          </Link>
        </div>
      </section>

      {/* -------------------------------------------------------------- Footer */}
      <footer className="bg-[#0A101E] text-[#9AA7BC]">
        <div className="mx-auto max-w-[1180px] px-5 pb-10 pt-12 sm:px-8 md:pt-16 lg:px-16 lg:pt-20">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <p className="font-display text-[18px] font-bold text-[#F2F6FC]">
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
                <p className="text-xs uppercase tracking-[0.14em] text-[#66738A]">
                  {col.head}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm transition-colors hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-11 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 text-[13px] text-[#66738A]">
            <span>© {new Date().getFullYear()} Bleacher Backers. All rights reserved.</span>
            <span>We never sell or share your data.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
