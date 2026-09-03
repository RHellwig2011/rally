"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Copy,
  Check,
  Loader2,
  Lock,
  Target,
  Users,
  Facebook,
  Twitter,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, calculatePercentage } from "@/lib/utils";
import { MONEY_HERO_SHADOW, formatWholeDollars } from "@/components/app-chrome";
import { StickyDonateBar } from "@/components/sticky-donate-bar";
import DonationForm from "@/components/DonationForm";

interface PlayerPageData {
  teamMember: {
    id: string;
    name: string;
    personalGoal: string | null;
    amountRaised: string;
    profilePhotoUrl: string | null;
    profileVideoUrl: string | null;
    personalStory: string | null;
    position: string | null;
    grade: string | null;
    favoriteQuote: string | null;
  };
  campaign: {
    id: string;
    organizationName: string;
    teamName: string;
    slug: string;
    description: string;
    goalAmount: string;
    currentAmount: string;
    logoUrl: string | null;
    bannerImageUrl: string | null;
    primaryColor: string;
    status: string;
    endDate: Date | null;
    platformFeePercent: number;
  };
  referralCode: string;
  recentDonations: Array<{
    id: string;
    donorName: string | null;
    grossAmount: string;
    isAnonymous: boolean;
    donorMessage: string | null;
    createdAt: Date;
  }>;
  stats: {
    donationCount: number;
    clickCount: number;
  };
}

export default function PlayerFundraisingPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<PlayerPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/raise/${params?.slug}/player/${params?.teamMemberId}?ref=${data?.referralCode || ''}`
    : '';

  const fetchPlayerData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        `/api/team-members/${params?.teamMemberId}/public`
      );
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to load player data");
      }

      setData(result);
    } catch (err) {
      console.error("Error fetching player data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [params?.teamMemberId]);

  useEffect(() => {
    fetchPlayerData();
  }, [fetchPlayerData]);

  // Only claim success once the clipboard write actually resolved.
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy share link:", err);
    }
  };

  const shareToSocial = (platform: string) => {
    const message = `Help ${data?.teamMember.name} reach their fundraising goal for ${data?.campaign.organizationName} ${data?.campaign.teamName}!`;

    let url = '';
    switch (platform) {
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'email':
        url = `mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(`${message}\n\n${shareUrl}`)}`;
        break;
      case 'sms':
        url = `sms:?body=${encodeURIComponent(`${message} ${shareUrl}`)}`;
        break;
    }

    if (!url) return;

    // mailto:/sms: hand off to the OS handler — a popup window would be blocked
    // or left behind as a blank tab. Web shares stay in a popup.
    if (platform === 'email' || platform === 'sms') {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading player page...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="text-center">
          <p className="mb-5 text-sm text-warning-dark">{error || "Player not found"}</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={fetchPlayerData}>
              Try again
            </Button>
            <Button onClick={() => router.push(`/raise/${params?.slug}`)}>
              Go to Campaign Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const percentage = data.teamMember.personalGoal
    ? calculatePercentage(
        parseInt(data.teamMember.amountRaised),
        parseInt(data.teamMember.personalGoal)
      )
    : 0;

  // CENTS throughout — formatCurrency (lib/utils) divides by 100 on the way out.
  const raised = parseInt(data.teamMember.amountRaised);
  const personalGoal = data.teamMember.personalGoal
    ? parseInt(data.teamMember.personalGoal)
    : null;
  const toGo = personalGoal !== null ? Math.max(0, personalGoal - raised) : null;

  // Initials for the no-photo jersey card. Student-athletes are shown as first
  // name and last initial, so this is at most two letters.
  const initials = data.teamMember.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join(" ");

  return (
    <div className="min-h-screen">
      {/* Site header — BRIEF §3, same chrome as the team campaign page. */}
      <nav className="sticky top-0 z-50 border-b border-border bg-[rgba(10,13,20,.86)] backdrop-blur-[10px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-[9px] w-[9px] flex-shrink-0 rounded-full bg-primary shadow-glow-team"
              />
              <span className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-foreground">
                Bleacher Backers
              </span>
            </Link>
            <Button
              onClick={() =>
                document
                  .getElementById("donate")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <Heart className="mr-2 h-4 w-4" />
              Donate Now
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Back link to the team campaign — BRIEF §4 screen 02. */}
        <Link
          href={`/raise/${data.campaign.slug}`}
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {data.campaign.teamName} team campaign
        </Link>

        {/* Masthead */}
        <header className="pb-6 pt-5">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-[12px]"
            style={{ textShadow: "0 0 14px rgba(200,16,46,.6)" }}
          >
            {data.campaign.organizationName} · {data.campaign.teamName}
          </p>
          <h1
            className="mt-3 font-display text-[clamp(34px,7vw,60px)] font-extrabold uppercase leading-[0.96] tracking-[-0.03em] text-foreground"
            style={{
              textShadow:
                "0 2px 0 rgba(200,16,46,.5), 0 6px 0 rgba(200,16,46,.2), 0 18px 44px rgba(200,16,46,.25)",
            }}
          >
            {data.teamMember.name}
          </h1>
          {(data.teamMember.grade || data.teamMember.position) && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {data.teamMember.grade && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {data.teamMember.grade}
                </span>
              )}
              {data.teamMember.grade && data.teamMember.position && <span>·</span>}
              {data.teamMember.position && (
                <span className="inline-flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  {data.teamMember.position}
                </span>
              )}
            </p>
          )}
        </header>

        {/* Hero pane. With a photo it is a lit frame; without one it is the
            floating jersey card, which is a designed state rather than a
            fallback — BRIEF §4 screen 02 "no-photo". */}
        {data.teamMember.profilePhotoUrl ? (
          <figure className="relative overflow-hidden rounded-card border border-white/10 shadow-card">
            {/* User-supplied remote URL: plain <img>, not next/image */}
            <img
              src={data.teamMember.profilePhotoUrl}
              alt={data.teamMember.name}
              width={960}
              height={640}
              loading="lazy"
              className="h-[280px] w-full object-cover sm:h-[360px]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent"
            />
          </figure>
        ) : (
          <div
            role="img"
            aria-label={`No photo shared. Jersey card showing the initials ${initials}.`}
            className="rounded-card border border-white/10 bg-[linear-gradient(165deg,#1B2334,#121826)] px-5 py-8 text-center shadow-card"
          >
            <div
              className="mx-auto w-[150px] rounded-card border border-[#33406A] px-4 pb-[18px] pt-6"
              style={{
                background: "linear-gradient(160deg,#141B33,#0A0E1A)",
                boxShadow:
                  "0 20px 40px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08)",
                transform: "rotateX(8deg)",
              }}
            >
              <p className="font-display text-[46px] font-extrabold leading-none tracking-[-0.02em] text-foreground">
                {data.teamMember.name.charAt(0).toUpperCase()}
              </p>
              <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {initials}
              </p>
            </div>
            <h2 className="mt-5 font-display text-base font-bold uppercase tracking-[-0.01em] text-foreground">
              No photo — and that&rsquo;s by design
            </h2>
            <p className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
              We show student-athletes without a photo unless a guardian opts in.
              The fundraiser is just as real.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Privacy protected by default
            </span>
          </div>
        )}

        {/* Money block */}
        <div className="pt-8 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Raised for {data.teamMember.name.split(" ")[0]}
          </p>
          <p
            className="mt-2 font-display text-[clamp(44px,10vw,72px)] font-extrabold tabular leading-none tracking-[-0.03em] text-foreground"
            style={{ textShadow: MONEY_HERO_SHADOW }}
          >
            {/* raised is CENTS on this page. */}
            {formatWholeDollars(raised / 100)}
          </p>
          {personalGoal !== null && (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                of a <span className="tabular text-foreground">{formatCurrency(personalGoal)}</span>{" "}
                personal goal
              </p>
              <div
                role="progressbar"
                aria-valuenow={Math.min(percentage, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${data.teamMember.name}'s fundraising progress`}
                className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(200,16,46,.7)] transition-all duration-500 ease-stadium"
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>
                  <span className="tabular text-foreground">{percentage}%</span> funded
                </span>
                {toGo !== null && (
                  <span>
                    <span className="tabular text-foreground">{formatCurrency(toGo)}</span> to go
                  </span>
                )}
              </div>
            </>
          )}

          {/* Stat blocks — BRIEF §3. */}
          <div className="mt-6 grid grid-cols-3 gap-3.5">
            {[
              { v: String(data.stats.donationCount), k: "Supporters" },
              {
                v: toGo !== null ? formatCurrency(toGo) : "—",
                k: "To go",
              },
              { v: String(data.stats.clickCount), k: "Page views" },
            ].map((stat) => (
              <div
                key={stat.k}
                className="rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-4 shadow-[0_10px_26px_rgba(0,0,0,.35)]"
              >
                <p className="text-[20px] font-semibold tabular leading-none text-foreground sm:text-[26px]">
                  {stat.v}
                </p>
                <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {stat.k}
                </p>
              </div>
            ))}
          </div>

          {/* The sticky bar watches this block — once it scrolls off the top
              of the viewport, the bar slides up to take over the ask. */}
          <div id="give">
          <Button
            size="lg"
            className="mt-6 h-[54px] w-full text-base"
            onClick={() =>
              document
                .getElementById("donate")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Heart className="mr-2 h-5 w-5" />
            Donate to {data.teamMember.name.split(" ")[0]}&rsquo;s fundraiser
          </Button>
          <p className="mt-3 flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left text-[13px] leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              One platform fee — {data.campaign.platformFeePercent}% — plus card
              processing, itemized before you give and never after.
            </span>
          </p>
          </div>
        </div>

        {/* Share row */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={copyShareLink}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => shareToSocial('facebook')}>
            <Facebook className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="ghost" size="sm" onClick={() => shareToSocial('twitter')}>
            <Twitter className="mr-2 h-4 w-4" />
            Tweet
          </Button>
          <Button variant="ghost" size="sm" onClick={() => shareToSocial('email')}>
            <Mail className="mr-2 h-4 w-4" />
            Email
          </Button>
          <Button variant="ghost" size="sm" onClick={() => shareToSocial('sms')}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Text
          </Button>
        </div>

        {/* Personal note — the athlete in their own words. */}
        {(data.teamMember.personalStory || data.teamMember.favoriteQuote) && (
          <div className="relative mt-10 rounded-card border border-white/10 bg-[linear-gradient(165deg,#1B2334,#121826)] p-6 shadow-card">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-2 left-3 font-display text-[64px] font-extrabold leading-none text-primary opacity-50"
            >
              &ldquo;
            </span>
            <div className="relative">
              {data.teamMember.personalStory && (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                  {data.teamMember.personalStory}
                </p>
              )}
              {data.teamMember.favoriteQuote && (
                <p className="mt-4 font-quote text-[19px] leading-snug text-muted-foreground">
                  {data.teamMember.favoriteQuote}
                </p>
              )}
            </div>
            <div className="relative mt-5 flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[13px] font-semibold text-foreground">
                {initials.replace(/ /g, "")}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {data.teamMember.name}
                </p>
                {(data.teamMember.grade || data.teamMember.position) && (
                  <p className="text-xs text-muted-foreground">
                    {[data.teamMember.grade, data.teamMember.position]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Video */}
        {data.teamMember.profileVideoUrl && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <h2 className="mb-4 font-display text-xl font-bold uppercase tracking-[-0.01em] text-foreground">
                My story
              </h2>
              <div className="aspect-video overflow-hidden rounded-lg border border-white/10">
                <video
                  src={data.teamMember.profileVideoUrl}
                  controls
                  className="h-full w-full"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gifts feed */}
        {data.recentDonations.length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-[-0.01em] text-foreground">
              <Heart className="h-5 w-5 text-primary" />
              Recent supporters
            </h2>
            <span aria-hidden className="mt-1.5 block h-[3px] w-[34px] rounded-sm bg-primary" />
            <ul className="mt-4 flex flex-col">
              {data.recentDonations.slice(0, 10).map((donation) => (
                <li
                  key={donation.id}
                  className="flex gap-3 border-t border-white/10 py-3.5 first:border-t-0 first:pt-0"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                    <Heart className="h-4 w-4 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {donation.isAnonymous
                          ? "Anonymous"
                          : donation.donorName || "Donor"}
                      </span>
                      <span className="flex-shrink-0 text-sm font-semibold tabular text-secondary">
                        {formatCurrency(parseInt(donation.grossAmount))}
                      </span>
                    </div>
                    {donation.donorMessage && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        &ldquo;{donation.donorMessage}&rdquo;
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {new Date(donation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Donate */}
        <div id="donate" className="mt-10 scroll-mt-20">
          <h2 className="mb-4 font-display text-xl font-bold uppercase tracking-[-0.01em] text-foreground">
            Support {data.teamMember.name}
          </h2>
          <DonationForm
            campaignId={data.campaign.id}
            campaignName={`${data.campaign.teamName} - ${data.campaign.organizationName}`}
            campaignSlug={data.campaign.slug}
            teamMemberId={data.teamMember.id}
            playerName={data.teamMember.name}
            platformFeePercent={data.campaign.platformFeePercent}
          />
        </div>

        {/* More from this team */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="mb-3 font-display text-base font-bold uppercase tracking-[-0.01em] text-foreground">
              About the campaign
            </h3>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              {data.campaign.description}
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/raise/${data.campaign.slug}`}>View full campaign</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer — extra bottom padding on mobile so the sticky donate bar
          never covers it. */}
      <footer className="mt-16 border-t border-white/10 px-4 py-8 pb-28 text-center sm:px-6 lg:px-8 lg:pb-8">
        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <span className="font-display font-bold text-foreground">
            Bleacher Backers
          </span>{" "}
          — fundraising reimagined
        </p>
      </footer>

      {/* Sticky bottom donate bar — BRIEF §4 screen 02. Appears once the
          #give block scrolls off the top; the CTA scrolls back down to the
          donation form. */}
      <StickyDonateBar
        watchId="give"
        feeLine={`One platform fee — ${data.campaign.platformFeePercent}% — plus card processing, shown before you give`}
        ctaLabel={`Donate to ${data.teamMember.name.split(" ")[0]}'s fundraiser`}
        onCtaClick={() =>
          document
            .getElementById("donate")
            ?.scrollIntoView({ behavior: "smooth" })
        }
      />
    </div>
  );
}
