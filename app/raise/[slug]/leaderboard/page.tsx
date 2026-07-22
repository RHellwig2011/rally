"use client";

import { useEffect, useState } from "react";
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

/** Medal colors for the top three; everyone else gets a plain rank chip. */
function rankStyles(rank: number): string {
  if (rank === 1) return "bg-secondary-100 text-secondary-800 border-secondary-300";
  if (rank === 2) return "bg-gray-100 text-gray-700 border-gray-300";
  if (rank === 3) return "bg-orange-100 text-orange-800 border-orange-300";
  return "bg-primary-50 text-primary-700 border-primary-200";
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

  useEffect(() => {
    async function load() {
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
    }

    load();
  }, [params.slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Leaderboard Not Available
          </h1>
          <p className="text-muted-foreground mb-4">
            {error || "This campaign does not exist or has been removed."}
          </p>
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const topAmount = entries.length > 0 ? entries[0].amountRaised : 0;

  return (
    <div className="min-h-screen bg-muted">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg leading-none">
                  R
                </span>
              </div>
              <span className="text-2xl font-bold text-foreground">Bleacher Backers</span>
            </Link>
            <Button asChild>
              <Link href={`/raise/${params.slug}/donate`}>
                <Heart className="w-4 h-4 mr-2" />
                Donate
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Banner */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 h-48 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white px-4">
            <Trophy className="w-10 h-10 mx-auto mb-3" />
            <h1 className="text-3xl sm:text-4xl font-bold">Top Fundraisers</h1>
            <p className="text-lg mt-2 text-primary-100">
              {campaign.organizationName} {campaign.teamName}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 pb-16">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Medal className="w-5 h-5 text-secondary" />
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
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No fundraisers on the board yet
                </h3>
                <p className="text-muted-foreground mb-4">
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
                      className="flex items-center gap-4 p-4 rounded-lg border bg-white hover:border-primary-300 hover:shadow-sm transition"
                    >
                      <div
                        className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold flex-shrink-0 ${rankStyles(
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
                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-primary">
                            {entry.name.charAt(0)}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-semibold text-foreground truncate">
                            {entry.name}
                          </p>
                          <span className="font-semibold text-success flex-shrink-0">
                            {formatCurrency(entry.amountRaised)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${relative}%` }}
                          />
                        </div>
                        {entry.percentOfGoal !== null && (
                          <p className="text-xs text-muted-foreground mt-1">
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
            <div className="mt-6 pt-5 border-t flex items-start gap-3 text-sm text-muted-foreground">
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
