"use client";

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Heart, Share2, Users, Calendar, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatRelativeTime, calculatePercentage, calculateDaysRemaining } from "@/lib/utils";
import { MONEY_HERO_SHADOW, SiteHeader, formatWholeDollars } from "@/components/app-chrome";
import { GiftTicker, type GiftTickerItem } from "@/components/gift-ticker";
import { StickyDonateBar } from "@/components/sticky-donate-bar";

interface CampaignData {
  id: string;
  slug: string;
  organizationName: string;
  teamName: string;
  description: string;
  goalAmount: string | number;
  currentAmount: string | number;
  platformFeePercent: number;
  logoUrl: string | null;
  bannerImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  category: string;
  primaryLeader: {
    firstName: string;
    lastName: string;
    email: string;
  };
  donations: Array<{
    id: string;
    donorName: string;
    grossAmount: number | string;
    donorMessage: string | null;
    isAnonymous: boolean;
    createdAt: Date | string;
  }>;
  cheerMessages: Array<{
    id: string;
    authorName: string;
    message: string;
    createdAt: Date | string;
  }>;
  updates: Array<{
    id: string;
    title: string;
    publishedAt: Date | string;
  }>;
  stats?: {
    donorCount: number;
    avgDonation: number;
  };
  donorCount?: number;
}

/**
 * useSearchParams() forces the whole tree it lives in to render on the client,
 * so the referral ping lives in its own Suspense-wrapped leaf instead of at the
 * top of the page. Renders nothing.
 */
function ReferralTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;
    const refCode = searchParams.get('ref');
    if (!refCode) return;

    // Fire and forget — a failed ping must never block the page.
    fetch('/api/referrals/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCode: refCode }),
    }).catch(err => console.error('Failed to track referral:', err));
  }, [searchParams]);

  return null;
}

export default function CampaignPage({ params }: { params: { slug: string } }) {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cheer message form state
  const [cheerDialogOpen, setCheerDialogOpen] = useState(false);
  const [cheerName, setCheerName] = useState("");
  const [cheerMessage, setCheerMessage] = useState("");
  const [cheerAnonymous, setCheerAnonymous] = useState(false);
  const [cheerSubmitting, setCheerSubmitting] = useState(false);
  const [cheerSuccess, setCheerSuccess] = useState(false);
  const [cheerError, setCheerError] = useState<string | null>(null);

  // Share state
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Fetch campaign data
  const fetchCampaign = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/campaigns/slug/${params.slug}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Campaign not found");
        return;
      }

      setCampaign(data.campaign);
    } catch (err) {
      console.error("Failed to fetch campaign:", err);
      setError("Failed to load campaign");
    } finally {
      setIsLoading(false);
    }
  }, [params.slug]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: campaign
            ? `${campaign.organizationName} ${campaign.teamName}`
            : 'Bleacher Backers',
          url,
        });
        return;
      } catch (err) {
        // A user-cancelled share is not a failure worth reporting.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareNotice("Link copied to your clipboard");
    } catch {
      setShareNotice("We couldn't copy the link — copy it from the address bar");
    }
    setTimeout(() => setShareNotice(null), 3000);
  };

  // Handle cheer message submission
  const handleCheerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaign) return;

    setCheerSubmitting(true);
    setCheerError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/cheer-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: cheerAnonymous ? "Anonymous" : cheerName,
          message: cheerMessage,
          isAnonymous: cheerAnonymous,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCheerSuccess(true);
        setCheerName("");
        setCheerMessage("");
        setCheerAnonymous(false);

        // Long enough to read the confirmation — closing at 2s read as the
        // note vanishing.
        setTimeout(() => {
          setCheerDialogOpen(false);
          setCheerSuccess(false);
        }, 5000);
      } else {
        setCheerError(data.error || "Failed to submit message");
      }
    } catch (err) {
      console.error("Failed to submit cheer message:", err);
      setCheerError("Failed to submit message. Please try again.");
    } finally {
      setCheerSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="text-center">
          <h1 className="mb-2 font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-foreground">
            Campaign not found
          </h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {error || "This campaign does not exist or has been removed."}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={fetchCampaign}>
              Try again
            </Button>
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const goalAmount = typeof campaign.goalAmount === 'string' ? parseInt(campaign.goalAmount) : campaign.goalAmount;
  const currentAmount = typeof campaign.currentAmount === 'string' ? parseInt(campaign.currentAmount) : campaign.currentAmount;
  const percentage = calculatePercentage(currentAmount, goalAmount);
  const daysLeft = calculateDaysRemaining(new Date(campaign.endDate));
  const donorCount = campaign.stats?.donorCount || campaign.donorCount || 0;
  // CENTS, like every other amount on this page — formatCurrency divides.
  const amountToGo = Math.max(0, goalAmount - currentAmount);

  // BRIEF §4 screen 01: the masthead sets the team name in two rows, the second
  // outlined rather than filled. Single-word names keep the filled treatment.
  const nameWords = campaign.teamName.trim().split(/\s+/);
  const nameHead = nameWords.length > 1 ? nameWords.slice(0, -1).join(" ") : campaign.teamName;
  const nameTail = nameWords.length > 1 ? nameWords[nameWords.length - 1] : "";

  // Worked example for the "where does my donation go?" disclosure. Mirrors the
  // fee math in components/DonationForm.tsx: this campaign's platform fee plus
  // Stripe's 2.9% + $0.30.
  const EXAMPLE_DONATION = 100;
  const feePercent = campaign.platformFeePercent ?? 10;
  const examplePlatformFee = EXAMPLE_DONATION * (feePercent / 100);
  const exampleProcessingFee = EXAMPLE_DONATION * 0.029 + 0.3;
  const exampleNet = Math.max(
    0,
    EXAMPLE_DONATION - examplePlatformFee - exampleProcessingFee
  );

  // Gift ticker items — BRIEF §4 screen 01: team cheer, recent gifts, and
  // campaign vitals in one loop. Donation amounts are CENTS here.
  const tickerItems: GiftTickerItem[] = [
    { bold: `GO ${campaign.teamName.toUpperCase()}` },
    ...campaign.donations.slice(0, 6).map((d) => ({
      before: d.donorName,
      bold: formatWholeDollars(
        (typeof d.grossAmount === "string"
          ? parseInt(d.grossAmount)
          : d.grossAmount) / 100
      ),
    })),
    ...(donorCount > 0
      ? [{ bold: `${donorCount}`, after: "donors" } as GiftTickerItem]
      : []),
    ...(daysLeft > 0
      ? [{ bold: `${daysLeft} days`, after: "left" } as GiftTickerItem]
      : []),
    { bold: `${percentage}%`, after: "funded" },
  ];

  return (
    <div className="min-h-screen pb-28 lg:pb-0">
      <Suspense fallback={null}>
        <ReferralTracker />
      </Suspense>

      {/* Site header — shared stadium-night chrome (BRIEF §3). Sits below the
          fixed red top rule from <Atmosphere />. */}
      <SiteHeader>
        <Button asChild>
          <Link href={`/raise/${params.slug}/donate`}>Donate to the team</Link>
        </Button>
      </SiteHeader>

      {/* Gift ticker — BRIEF §4 screen 01: live gifts and vitals in a
          marquee loop between the header and the masthead. */}
      <GiftTicker items={tickerItems} />

      {/* Masthead — school kicker over the big uppercase team name. */}
      <header className="mx-auto max-w-7xl px-4 pb-6 pt-10 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300 sm:text-[12px]"
           style={{ textShadow: "0 0 14px rgba(200,16,46,.6)" }}>
          {campaign.organizationName}
        </p>
        <h1
          className="mt-3 font-display text-[clamp(38px,7vw,72px)] font-extrabold uppercase leading-[0.94] tracking-[-0.03em] text-foreground"
          style={{
            textShadow:
              "0 2px 0 rgba(200,16,46,.5), 0 6px 0 rgba(200,16,46,.2), 0 18px 44px rgba(200,16,46,.25)",
          }}
        >
          {nameHead}
          {nameTail && (
            <span
              className="outline-text block"
              style={{ "--outline-stroke": "1.5px #8B93A3", textShadow: "none" } as CSSProperties}
            >
              {nameTail}
            </span>
          )}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {campaign.category || "Fundraising campaign"}
        </p>
      </header>

      {/* Photo scene — BRIEF §4 screen 01 "scene": a real banner takes the
          frame with a floodlight bloom at its base and the team crest riding
          over it; without one the frame is a lit night gradient rather than
          a flat brand block. */}
      <div className="relative h-56 overflow-hidden border-y border-white/10 sm:h-72 lg:h-80">
        {campaign.bannerImageUrl ? (
          <>
            <img
              src={campaign.bannerImageUrl}
              alt={campaign.teamName}
              className="h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"
            />
            {/* Bloom — the floodlight glow rising from the base of the frame. */}
            <div
              aria-hidden
              className="absolute -bottom-[70px] left-1/2 h-[300px] w-[360px] -translate-x-1/2 rounded-full blur-[8px]"
              style={{
                background:
                  "radial-gradient(circle, rgba(220,232,255,.38), rgba(200,16,46,.22) 45%, transparent 72%)",
              }}
            />
            {/* Crest — the team logo rides over the photo with a red glow. */}
            {campaign.logoUrl && (
              <img
                src={campaign.logoUrl}
                alt={`${campaign.teamName} crest`}
                loading="lazy"
                className="absolute bottom-5 left-1/2 h-auto w-[120px] -translate-x-1/2 sm:w-[150px]"
                style={{
                  filter:
                    "drop-shadow(0 0 24px rgba(200,16,46,.55)) drop-shadow(0 10px 20px rgba(0,0,0,.65))",
                }}
              />
            )}
          </>
        ) : (
          <>
            {campaign.logoUrl ? (
              <img
                src={campaign.logoUrl}
                alt=""
                aria-hidden
                className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-lg object-cover"
                style={{
                  filter:
                    "drop-shadow(0 0 24px rgba(200,16,46,.55)) drop-shadow(0 10px 20px rgba(0,0,0,.65))",
                }}
              />
            ) : (
              <span
                aria-hidden
                className="outline-text absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[96px] font-extrabold leading-none"
                style={{ "--outline-stroke": "2px rgba(255,255,255,.14)" } as CSSProperties}
              >
                {campaign.teamName.charAt(0)}
              </span>
            )}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(60% 60% at 20% 0%, rgba(200,16,46,.22), transparent 65%), radial-gradient(60% 60% at 80% 0%, rgba(120,170,255,.14), transparent 65%)",
              }}
            />
          </>
        )}
      </div>

      {/* Money block — BRIEF §4 screen 01: raised total, goal line, bar, stats,
          red donate CTA with the fee line beneath it. */}
      <div className="mx-auto max-w-3xl px-4 pt-10 text-center sm:px-6 lg:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Raised so far
        </p>
        <p
          className="mt-2 font-display text-[clamp(48px,11vw,76px)] font-extrabold tabular leading-none tracking-[-0.03em] text-foreground"
          style={{ textShadow: MONEY_HERO_SHADOW }}
        >
          {/* currentAmount is CENTS on this page. */}
          {formatWholeDollars(currentAmount / 100)}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          of a <span className="tabular text-foreground">{formatWholeDollars(goalAmount / 100)}</span> goal
        </p>

        <Progress
          variant="team"
          value={currentAmount}
          max={goalAmount}
          label="Campaign funding progress"
          className="mt-5"
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>
            <span className="tabular text-foreground">{percentage}%</span> funded
          </span>
          <span>
            <span className="tabular text-foreground">{formatWholeDollars(amountToGo / 100)}</span> to go
          </span>
        </div>

        {/* Three-stat grid — BRIEF §3 "Stat blocks". */}
        <div className="mt-6 grid grid-cols-3 gap-3.5">
          {[
            { v: donorCount, k: donorCount === 1 ? "Donor" : "Donors" },
            { v: daysLeft, k: daysLeft === 1 ? "Day left" : "Days left" },
            {
              v: campaign.updates.length,
              k: campaign.updates.length === 1 ? "Update" : "Updates",
            },
          ].map((stat) => (
            <div
              key={stat.k}
              className="rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-4 shadow-[0_10px_26px_rgba(0,0,0,.35)]"
            >
              <p className="text-[22px] font-semibold tabular leading-none text-foreground sm:text-[28px]">
                {stat.v}
              </p>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {stat.k}
              </p>
            </div>
          ))}
        </div>

        {/* The sticky bar watches this block — once it scrolls off the top of
            the viewport, the bar slides up to take over the ask. */}
        <div id="give">
        <Button asChild size="lg" className="mt-6 h-[54px] w-full text-base">
          <Link href={`/raise/${params.slug}/donate`}>
            <Heart className="mr-2 h-5 w-5" />
            Donate to the team
          </Link>
        </Button>
        <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left text-[13px] leading-relaxed text-muted-foreground">
          No fine print under these lights: on a{" "}
          <span className="tabular text-foreground">${EXAMPLE_DONATION.toFixed(2)}</span> gift,{" "}
          <span className="font-semibold tabular text-secondary">
            ${exampleNet.toFixed(2)}
          </span>{" "}
          reaches the team. One platform fee — {feePercent}% — plus card
          processing, shown before you give, never after.
        </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Campaign Info */}
          <div className="space-y-6 lg:col-span-2">
            {/* Campaign Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  {campaign.logoUrl ? (
                    <img
                      src={campaign.logoUrl}
                      alt={campaign.teamName}
                      className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05]">
                      <span className="font-display text-2xl font-extrabold text-primary">
                        {campaign.teamName.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <CardTitle className="mb-1 text-xl uppercase">
                      About the campaign
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {campaign.organizationName} {campaign.teamName}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {campaign.description.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="mb-3 text-[15px] leading-relaxed text-muted-foreground last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </CardContent>
            </Card>

            {/* Recent gifts feed — BRIEF §4 screen 01 "gifts". */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl uppercase">
                  <Heart className="h-5 w-5 text-primary" />
                  Recent gifts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaign.donations.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No donations yet. Be the first to back this team.
                  </p>
                ) : (
                <ul className="flex flex-col">
                  {campaign.donations.map((donation) => (
                    <li
                      key={donation.id}
                      className="flex gap-3 border-t border-white/10 py-3.5 first:border-t-0 first:pt-0"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[13px] font-semibold text-foreground">
                        {donation.donorName.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {donation.donorName}
                          </p>
                          <span className="flex-shrink-0 text-sm font-semibold tabular text-secondary">
                            {formatCurrency(typeof donation.grossAmount === 'string' ? parseInt(donation.grossAmount) : donation.grossAmount)}
                          </span>
                        </div>
                        {donation.donorMessage && (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            &ldquo;{donation.donorMessage}&rdquo;
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          {formatRelativeTime(new Date(donation.createdAt))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                )}
              </CardContent>
            </Card>

            {/* Cheer Wall */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl uppercase">
                  📣 Cheer wall
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaign.cheerMessages && campaign.cheerMessages.length > 0 ? (
                  <div className="space-y-3">
                    {campaign.cheerMessages.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-[12px] border border-white/10 bg-white/[0.04] p-4"
                      >
                        <p className="mb-2 text-[15px] leading-relaxed text-foreground">
                          &ldquo;{message.message}&rdquo;
                        </p>
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                          {message.authorName}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No messages yet. Be the first to cheer them on!
                  </p>
                )}

                <Dialog open={cheerDialogOpen} onOpenChange={setCheerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="mt-4 w-full">
                      Leave a Message
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleCheerSubmit}>
                      <DialogHeader>
                        <DialogTitle>Leave a Cheer Message</DialogTitle>
                        <DialogDescription>
                          Send words of encouragement to the team!
                        </DialogDescription>
                      </DialogHeader>

                      {cheerSuccess ? (
                        <div className="py-8 text-center">
                          <div className="mb-2 text-4xl">🎉</div>
                          <p className="font-semibold text-success-dark">Message submitted!</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Thanks — the team will see this after a quick look.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="cheer-name">Your Name</Label>
                              <Input
                                id="cheer-name"
                                placeholder="Enter your name"
                                value={cheerName}
                                onChange={(e) => setCheerName(e.target.value)}
                                disabled={cheerAnonymous || cheerSubmitting}
                                required={!cheerAnonymous}
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="cheer-anonymous"
                                checked={cheerAnonymous}
                                onChange={(e) => setCheerAnonymous(e.target.checked)}
                                disabled={cheerSubmitting}
                                className="h-4 w-4 accent-[#C8102E]"
                              />
                              <Label htmlFor="cheer-anonymous" className="cursor-pointer text-sm font-normal">
                                Post anonymously
                              </Label>
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="cheer-message">Message</Label>
                              <Textarea
                                id="cheer-message"
                                placeholder="Write your message of support..."
                                value={cheerMessage}
                                onChange={(e) => setCheerMessage(e.target.value)}
                                disabled={cheerSubmitting}
                                required
                                maxLength={500}
                                rows={4}
                              />
                              <p className="text-right text-xs tabular text-muted-foreground">
                                {cheerMessage.length}/500 characters
                              </p>
                            </div>
                          </div>

                          {cheerError && (
                            <p
                              role="alert"
                              className="mb-3 rounded-lg border border-warning/40 bg-warning-light px-3 py-2 text-sm text-warning-dark"
                            >
                              {cheerError}
                            </p>
                          )}

                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCheerDialogOpen(false)}
                              disabled={cheerSubmitting}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={cheerSubmitting}>
                              {cheerSubmitting ? "Submitting..." : "Submit Message"}
                            </Button>
                          </DialogFooter>
                        </>
                      )}
                    </form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Campaign Updates — hidden entirely until there is one to show */}
            {campaign.updates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl uppercase">Campaign updates</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col">
                  {campaign.updates.map((update) => (
                    <li
                      key={update.id}
                      className="flex items-center gap-3 border-t border-white/10 py-3 first:border-t-0 first:pt-0"
                    >
                      <Calendar className="h-4 w-4 flex-shrink-0 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{update.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(new Date(update.publishedAt))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Right Column — actions. The raised total and progress live in the
              masthead block above, so this column carries the ways in: quick
              amounts, the board, sharing, and the fee disclosure. */}
          <div className="order-first lg:order-none lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    A typical gift
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[25, 50, 100].map((quickAmount) => (
                      <Button key={quickAmount} variant="outline" size="sm" asChild>
                        <Link href={`/raise/${params.slug}/donate?amount=${quickAmount}`}>
                          <span className="tabular">${quickAmount}</span>
                        </Link>
                      </Button>
                    ))}
                  </div>

                  <Button className="mt-4 w-full" size="lg" asChild>
                    <Link href={`/raise/${params.slug}/donate`}>
                      <Heart className="mr-2 h-4 w-4" />
                      Donate now
                    </Link>
                  </Button>

                  <Button variant="outline" className="mt-3 w-full" asChild>
                    <Link href={`/raise/${params.slug}/leaderboard`}>
                      <Trophy className="mr-2 h-4 w-4" />
                      Top fundraisers
                    </Link>
                  </Button>

                  <Button variant="ghost" className="mt-2 w-full" onClick={handleShare}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share campaign
                  </Button>
                  {shareNotice && (
                    <p role="status" className="mt-2 text-center text-xs text-muted-foreground">
                      {shareNotice}
                    </p>
                  )}

                  {/* Fee Breakdown */}
                  <div className="mt-6 border-t border-white/10 pt-5">
                    <details className="cursor-pointer">
                      <summary className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Where does the money go?
                      </summary>
                      <div className="mt-3 text-sm">
                        <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-muted-foreground">
                          <span>Your gift</span>
                          <span className="tabular text-foreground">
                            ${EXAMPLE_DONATION.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-muted-foreground">
                          <span>Card processing</span>
                          <span className="tabular">~${exampleProcessingFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-muted-foreground">
                          <span>Bleacher Backers keeps</span>
                          <span className="tabular">${examplePlatformFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-3 text-base font-semibold text-foreground">
                          <span>The team receives</span>
                          <span
                            className="tabular font-bold text-secondary"
                            style={{ textShadow: "0 0 18px rgba(34,196,139,.4)" }}
                          >
                            ${exampleNet.toFixed(2)}
                          </span>
                        </div>
                        <p className="pt-3 text-xs leading-relaxed text-muted-foreground">
                          Card companies charge a small processing fee. We show it
                          so nothing is a surprise.
                        </p>
                      </div>
                    </details>
                  </div>
                </CardContent>
              </Card>

              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {donorCount} {donorCount === 1 ? "person has" : "people have"} backed this team
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom donate bar — BRIEF §4 screen 01. Hidden until the
          #give block scrolls off the top of the viewport, then it slides up
          and keeps the ask pinned. Hidden at lg, where the sticky widget
          column already does this job. */}
      <StickyDonateBar
        watchId="give"
        feeLine={`On a $${EXAMPLE_DONATION} gift, $${exampleNet.toFixed(2)} reaches the team`}
        ctaLabel="Donate to the team"
        ctaHref={`/raise/${params.slug}/donate`}
      />
    </div>
  );
}
