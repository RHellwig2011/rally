"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  DollarSign,
  Users,
  MousePointer,
  Share2,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InitialsAvatar,
  Kicker,
  SiteHeader,
  statStyles,
} from "@/components/app-chrome";
import { formatCurrency, calculatePercentage } from "@/lib/utils";

const { cell: STAT_CELL, num: STAT_NUM, label: STAT_LABEL } = statStyles;

interface PlayerData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  stats: {
    totalRaised: number;
    totalDonations: number;
    totalClicks: number;
    campaignCount: number;
  };
  memberships: Array<{
    id: string;
    name: string;
    personalGoal?: string;
    amountRaised: string;
    campaign: {
      id: string;
      organizationName: string;
      teamName: string;
      slug: string;
      goalAmount: string;
      currentAmount: string;
      status: string;
      endDate: Date | null;
    };
    referral: {
      code: string;
      clickCount: number;
      donationCount: number;
      totalRaised: string;
    } | null;
  }>;
}

export default function PlayerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<PlayerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayerData();
  }, []);

  const fetchPlayerData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/players/me');
      const result = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?redirect=/player');
          return;
        }
        throw new Error(result.error || 'Failed to fetch player data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching player data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * The player's own page — "Support Maya", not the team landing page. The
   * public route resolves a team member by id or fundLinkCode, and ?ref keeps
   * click attribution the way the public player page builds it.
   */
  const personalLink = (
    slug: string,
    teamMemberId: string,
    code?: string | null
  ) =>
    `${window.location.origin}/raise/${slug}/player/${teamMemberId}${
      code ? `?ref=${code}` : ''
    }`;

  const copyPersonalLink = (
    teamMemberId: string,
    slug: string,
    code?: string | null
  ) => {
    navigator.clipboard.writeText(personalLink(slug, teamMemberId, code));
    setCopiedId(teamMemberId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareOnSocial = (
    platform: string,
    teamMemberId: string,
    slug: string,
    teamName: string,
    code?: string | null
  ) => {
    const link = personalLink(slug, teamMemberId, code);
    const message = `I'm raising money for ${teamName}. A gift of any size helps — thank you!`;

    let shareUrl = '';
    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(link)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(`${message}\n\n${link}`)}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-warning mb-4">{error || 'Failed to load data'}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <SiteHeader>
        <span className="text-[13px] font-medium text-muted-foreground">
          {data.user.firstName} {data.user.lastName}
        </span>
        <InitialsAvatar
          initials={`${data.user.firstName?.[0] ?? ""}${data.user.lastName?.[0] ?? ""}`.toUpperCase()}
        />
      </SiteHeader>

      {/* BRIEF §4 screen 07: centered narrow column. */}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Welcome Header — hero with the big personal total */}
        <div className="mb-8 text-center">
          <Kicker>Welcome back, {data.user.firstName}</Kicker>
          <p className="mt-3 font-display text-[clamp(48px,14vw,72px)] font-black leading-none tracking-[-0.04em] tabular text-foreground [text-shadow:0_2px_0_rgba(200,16,46,.45),0_12px_42px_rgba(200,16,46,.35)]">
            {formatCurrency(data.stats.totalRaised)}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            raised so far. Share your page — that&apos;s how gifts show up.
          </p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Total Raised
              </CardTitle>
              <DollarSign className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-foreground">
                {formatCurrency(data.stats.totalRaised)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Across all campaigns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Donations
              </CardTitle>
              <Users className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-foreground">
                {data.stats.totalDonations}
              </div>
              <p className="text-sm text-muted-foreground mt-1">People supported you</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                People who opened my page
              </CardTitle>
              <MousePointer className="w-5 h-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-foreground">
                {data.stats.totalClicks}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Across all campaigns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Active Campaigns
              </CardTitle>
              <Trophy className="w-5 h-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-foreground">
                {data.stats.campaignCount}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Teams you're on</p>
            </CardContent>
          </Card>
        </div>

        {/* My Campaigns */}
        <div>
          <h2 className="mb-4 font-display text-xl font-extrabold uppercase tracking-[0.04em] text-foreground">
            My Campaigns
          </h2>

          {data.memberships.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No campaigns yet
                </h3>
                <p className="text-muted-foreground">
                  You'll see your fundraising campaigns here once you're added to a team
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {data.memberships.map((membership) => {
                const percentage = membership.personalGoal
                  ? calculatePercentage(
                      parseInt(membership.amountRaised),
                      parseInt(membership.personalGoal)
                    )
                  : 0;

                return (
                  <Card key={membership.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl mb-1">
                            {membership.campaign.organizationName} {membership.campaign.teamName}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">Your role: {membership.name}</p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/raise/${membership.campaign.slug}`} target="_blank">
                            View Page
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Personal Progress */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Your Progress
                            </span>
                            <span className="font-display text-lg font-extrabold tabular text-foreground">
                              {formatCurrency(parseInt(membership.amountRaised))}
                              {membership.personalGoal && (
                                <span className="text-sm font-semibold text-muted-foreground">
                                  {' '}/ {formatCurrency(parseInt(membership.personalGoal))}
                                </span>
                              )}
                            </span>
                          </div>
                          {membership.personalGoal && (
                            /* Personal bar runs team red — BRIEF §4 screen 07 ".pbar" */
                            <div className="mb-1 h-2 w-full overflow-hidden rounded-full border border-border bg-white/[0.06]">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,#8E0A20,#C8102E_60%,#F0495F)] shadow-glow-team transition-all duration-700 ease-stadium"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Referral Stats */}
                        {membership.referral && (
                          /* BRIEF §3 "Stat blocks" */
                          <div className="grid grid-cols-2 gap-3.5">
                            <div className={STAT_CELL}>
                              <p className={STAT_NUM}>{membership.referral.clickCount}</p>
                              <p className={STAT_LABEL}>People who opened my page</p>
                            </div>
                            <div className={STAT_CELL}>
                              <p className={`${STAT_NUM} text-success-dark`}>
                                {membership.referral.donationCount}
                              </p>
                              <p className={STAT_LABEL}>Donations</p>
                            </div>
                          </div>
                        )}

                        {/* Share block. Lives outside the referral check: the
                            player's page exists whether or not a Referral row
                            was ever created, and sharing it is the whole job. */}
                        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            My fundraising page
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={personalLink(
                                membership.campaign.slug,
                                membership.id,
                                membership.referral?.code
                              )}
                              className="h-11 flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 text-sm text-muted-foreground"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                copyPersonalLink(
                                  membership.id,
                                  membership.campaign.slug,
                                  membership.referral?.code
                                )
                              }
                            >
                              {copiedId === membership.id ? (
                                <>
                                  <Check className="w-4 h-4 mr-1" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 mr-1" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>

                          <div className="flex gap-2">
                            {(['facebook', 'twitter', 'email'] as const).map((platform) => (
                              <Button
                                key={platform}
                                size="sm"
                                variant="outline"
                                className="flex-1 capitalize"
                                onClick={() =>
                                  shareOnSocial(
                                    platform,
                                    membership.id,
                                    membership.campaign.slug,
                                    membership.campaign.teamName,
                                    membership.referral?.code
                                  )
                                }
                              >
                                <Share2 className="w-4 h-4 mr-1" />
                                {platform}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* The two things a player does next */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Button variant="outline" asChild>
                            <Link href={`/player/outreach/${membership.id}`}>
                              Text / email family
                            </Link>
                          </Button>
                          <Button variant="outline" asChild>
                            <Link href={`/player/profile/${membership.id}`}>
                              Edit my page
                            </Link>
                          </Button>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
