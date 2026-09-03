"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, Info, Medal, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, calculatePercentage } from "@/lib/utils";

/**
 * Public top-10 leaderboard for a campaign.
 *
 * The API decides what is public: this page requests scope=public and receives
 * at most the top 10 players with display-safe fields only. There is no
 * client-side filtering here — the rest of the roster never reaches the
 * browser.
 */

interface PublicEntry {
  rank: number;
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  // CENTS — formatCurrency() takes these directly.
  amountRaised: number;
  personalGoal: number | null;
  percentOfGoal: number | null;
  fundraisingPath: string;
}

interface CampaignSummary {
  id: string;
  slug: string;
  organizationName: string;
  teamName: string;
  logoUrl: string | null;
  bannerImageUrl: string | null;
}

/**
 * Medal colors for the top three; everyone else gets a plain rank chip.
 * Night palette: soft tinted fills over the dark shell rather than the old
 * light-theme -100 washes (BRIEF §1).
 */
function rankStyles(rank: number): string {
  if (rank === 1)
    return "border-secondary/50 bg-[rgba(34,196,139,.12)] text-secondary shadow-[0_0_16px_rgba(34,196,139,.3)]";
  if (rank === 2) return "border-white/20 bg-white/[0.08] text-foreground";
  if (rank === 3)
    return "border-[rgba(232,163,61,.45)] bg-[rgba(232,163,61,.10)] text-[#E8A33D]";
  return "border-white/10 bg-white/[0.04] text-muted-foreground";
}

export default function PublicLeaderboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [entries, setEntries] = useState<PublicEntry[]>([]);
  const [publicLimit, setPublicLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Resolve slug -> campaign via the existing public route.
      const campaignRes = await fetch(`/api/campaigns/slug/${params.slug}`);
      const campaignJson = await campaignRes.json();

      if (!campaignRes.ok || !campaignJson.success) {
        setError(campaignJson.error || "Campaign not found");
        return;
      }

      const c = campaignJson.campaign;
      setCampaign({
        id: c.id,
        slug: c.slug,
        organizationName: c.organizationName,
        teamName: c.teamName,
        logoUrl: c.logoUrl,
        bannerImageUrl: c.bannerImageUrl,
      });

      const lbRes = await fetch(
        `/api/campaigns/${c.id}/leaderboard?scope=public`
      );
      const lbJson = await lbRes.json();

      if (!lbRes.ok || !lbJson.success) {
        setError(lbJson.error || "Failed to load the leaderboard");
        return;
      }

      setEntries(lbJson.leaderboard);
      setPublicLimit(lbJson.publicLimit ?? 10);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
      setError("Failed to load the leaderboard");
    } finally {
      setIsLoading(false);
    }
  }, [params.slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="text-center">
          <h1 className="mb-2 font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-foreground">
            Leaderboard not available
          </h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {error || "This campaign does not exist or has been removed."}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={load}>
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

  const topAmount = entries.length > 0 ? entries[0].amountRaised : 0;

  return (
    <div className="min-h-screen">
      {/* Site header — BRIEF §3, the same chrome as the campaign page. */}
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
            <Button asChild>
              <Link href={`/raise/${params.slug}/donate`}>
                <Heart className="mr-2 h-4 w-4" />
                Donate
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Masthead */}
      <header className="mx-auto max-w-3xl px-4 pb-8 pt-10 text-center sm:px-6 lg:px-8">
        <Trophy className="mx-auto mb-4 h-9 w-9 text-primary" />
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-[12px]"
          style={{ textShadow: "0 0 14px rgba(200,16,46,.6)" }}
        >
          {campaign.organizationName} {campaign.teamName}
        </p>
        <h1
          className="mt-3 font-display text-[clamp(32px,7vw,56px)] font-extrabold uppercase leading-[0.96] tracking-[-0.03em] text-foreground"
          style={{
            textShadow:
              "0 2px 0 rgba(200,16,46,.5), 0 6px 0 rgba(200,16,46,.2), 0 18px 44px rgba(200,16,46,.25)",
          }}
        >
          Top fundraisers
        </h1>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-xl uppercase">
                <Medal className="h-5 w-5 text-secondary" />
                Top {publicLimit}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/raise/${params.slug}`}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Campaign
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-display text-lg font-bold uppercase tracking-[-0.01em] text-foreground">
                  No fundraisers on the board yet
                </h3>
                <p className="mb-5 text-sm text-muted-foreground">
                  Be the first to support this team.
                </p>
                <Button asChild>
                  <Link href={`/raise/${params.slug}/donate`}>
                    <Heart className="w-4 h-4 mr-2" />
                    Donate Now
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => {
                  // Bar is relative to the current leader, so the board reads
                  // as a race rather than as progress toward a private goal.
                  const relative = calculatePercentage(
                    entry.amountRaised,
                    topAmount
                  );

                  return (
                    <Link
                      key={entry.id}
                      href={entry.fundraisingPath}
                      className="flex items-center gap-4 rounded-[12px] border border-white/10 bg-white/[0.04] p-4 transition-[transform,background-color,border-color] duration-200 ease-spring hover:translate-x-1 hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border font-display font-bold tabular ${rankStyles(
                          entry.rank
                        )}`}
                      >
                        {entry.rank}
                      </div>

                      {entry.profilePhotoUrl ? (
                        <img
                          src={entry.profilePhotoUrl}
                          alt={entry.name}
                          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                          <span className="font-display text-lg font-bold text-foreground">
                            {entry.name.charAt(0)}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {entry.name}
                          </p>
                          <span className="flex-shrink-0 text-sm font-semibold tabular text-secondary">
                            {formatCurrency(entry.amountRaised)}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={relative}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${entry.name}'s total relative to the leader`}
                          className="mt-2 h-[5px] overflow-hidden rounded-full bg-white/10"
                        >
                          <div
                            className="h-full rounded-full bg-secondary shadow-glow-accent transition-all duration-700 ease-stadium"
                            style={{ width: `${relative}%` }}
                          />
                        </div>
                        {entry.percentOfGoal !== null && (
                          <p className="mt-1.5 text-xs tabular text-muted-foreground">
                            {entry.percentOfGoal}% of personal goal
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Honest disclosure about what this board is */}
            <div className="mt-6 flex items-start gap-3 border-t border-white/10 pt-5 text-sm text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p>
                Only the top {publicLimit} fundraisers are shown publicly. Many
                more players are raising money for this team — every player has
                their own page, and the full roster is visible to the coaching
                staff.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button size="lg" asChild>
            <Link href={`/raise/${params.slug}/donate`}>
              <Heart className="w-4 h-4 mr-2" />
              Support This Team
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
