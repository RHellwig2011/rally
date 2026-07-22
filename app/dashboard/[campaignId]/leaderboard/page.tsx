"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  DollarSign,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

/**
 * Staff-only leaderboard. Shows the FULL ranked roster — including everyone
 * below the public top-10 cutoff — so a coach can see who needs help.
 *
 * The public/staff split is enforced by the API, not here: this page requests
 * scope=staff, which 403s for anyone who is not the campaign leader or an
 * ADMIN. The public page requests scope=public and physically cannot receive
 * the rows below the cutoff.
 */

interface StaffEntry {
  rank: number;
  id: string;
  name: string;
  email: string | null;
  profilePhotoUrl: string | null;
  // CENTS — formatCurrency() takes these directly.
  amountRaised: number;
  personalGoal: number | null;
  percentOfGoal: number | null;
  contactCount: number;
  donationCount: number;
  contactsRemaining: number;
  belowContactQuota: boolean;
  publiclyVisible: boolean;
  isProfilePublic: boolean;
  needsAttention: boolean;
  fundraisingPath: string;
}

interface LeaderboardResponse {
  success: boolean;
  scope: string;
  publicLimit: number;
  minContactsPerPlayer: number;
  campaign: {
    id: string;
    slug: string;
    teamName: string;
    organizationName: string;
  };
  leaderboard: StaffEntry[];
  totals: {
    playerCount: number;
    hiddenFromPublic: number;
    totalRaised: number;
    playersWithNothingRaised: number;
    playersBelowContactQuota: number;
    playersNeedingAttention: number;
  };
}

export default function StaffLeaderboardPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const router = useRouter();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(
          `/api/campaigns/${params.campaignId}/leaderboard?scope=staff`
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          if (res.status === 403) {
            setError(
              "You do not have access to this campaign's staff leaderboard."
            );
            return;
          }
          throw new Error(json.error || "Failed to load leaderboard");
        }

        setData(json);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load leaderboard"
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaderboard();
  }, [params.campaignId, router]);

  const nav = (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="text-2xl font-bold text-foreground">Rally</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link href={`/dashboard/${params.campaignId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted">
        {nav}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted">
        {nav}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Can&apos;t show the leaderboard
              </h2>
              <p className="text-muted-foreground">{error || "Something went wrong."}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { leaderboard, totals, publicLimit, minContactsPerPlayer, campaign } = data;
  const quotaTracked = minContactsPerPlayer > 0;

  return (
    <div className="min-h-screen bg-muted">
      {nav}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Player Leaderboard
            </h1>
            <p className="text-muted-foreground">
              {campaign.organizationName} {campaign.teamName} — full roster,
              staff only. The public board shows the top {publicLimit}.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/raise/${campaign.slug}/leaderboard`} target="_blank">
              <ExternalLink className="w-4 h-4 mr-2" />
              View public board
            </Link>
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Players Ranked
              </CardTitle>
              <Users className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {totals.playerCount}
              </div>
              <p className="text-sm text-muted-foreground mt-1">On this campaign</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Raised
              </CardTitle>
              <DollarSign className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(totals.totalRaised)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Across the roster</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Hidden From Public
              </CardTitle>
              <EyeOff className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {totals.hiddenFromPublic}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Below the cutoff or profile set to private
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Need Attention
              </CardTitle>
              <AlertCircle className="w-5 h-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {totals.playersNeedingAttention}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {totals.playersWithNothingRaised} at $0
                {quotaTracked
                  ? ` · ${totals.playersBelowContactQuota} under contact quota`
                  : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-warning" />
              Full Ranked Roster ({leaderboard.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Everything above the dashed line is what donors see on the public
              page. Everything below it is visible to coaching staff only.
            </p>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No players on the roster yet
                </h3>
                <p className="text-muted-foreground">
                  Add team members to start ranking them.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Rank
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Player
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">
                        Raised
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">
                        % of Goal
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">
                        Contacts
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">
                        Donations
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Flags
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => {
                      // Draw the cutoff line immediately after the last row the
                      // public board can contain.
                      const isCutoffRow =
                        entry.rank === publicLimit &&
                        index < leaderboard.length - 1;

                      return (
                        <tr
                          key={entry.id}
                          className={[
                            "border-b hover:bg-gray-50",
                            entry.needsAttention ? "bg-red-50/60" : "",
                            isCutoffRow
                              ? "border-b-2 border-dashed border-primary-400"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">
                                #{entry.rank}
                              </span>
                              {entry.rank === 1 && (
                                <Trophy className="w-4 h-4 text-warning" />
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Link
                              href={entry.fundraisingPath}
                              target="_blank"
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {entry.name}
                            </Link>
                            {entry.email && (
                              <p className="text-sm text-muted-foreground">
                                {entry.email}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <span
                              className={
                                entry.amountRaised === 0
                                  ? "font-semibold text-red-600"
                                  : "font-semibold text-success"
                              }
                            >
                              {formatCurrency(entry.amountRaised)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            {entry.percentOfGoal === null ? (
                              <span className="text-sm text-muted-foreground">
                                No goal set
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <div className="w-20 h-2 bg-accent rounded-full overflow-hidden">
                                  <div
                                    className={
                                      entry.percentOfGoal >= 100
                                        ? "h-full bg-success"
                                        : "h-full bg-primary"
                                    }
                                    style={{
                                      width: `${Math.min(entry.percentOfGoal, 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm text-foreground w-12 text-right">
                                  {entry.percentOfGoal}%
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <span
                              className={
                                entry.belowContactQuota
                                  ? "font-semibold text-red-600"
                                  : "text-gray-900"
                              }
                            >
                              {entry.contactCount}
                              {quotaTracked && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  / {minContactsPerPlayer}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right text-foreground whitespace-nowrap">
                            {entry.donationCount}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {entry.publiclyVisible ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                                  <Eye className="w-3 h-3" />
                                  Public
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                                  <EyeOff className="w-3 h-3" />
                                  Staff only
                                </span>
                              )}
                              {!entry.isProfilePublic && (
                                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                                  Profile private
                                </span>
                              )}
                              {entry.amountRaised === 0 && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-warning-light text-warning">
                                  <AlertCircle className="w-3 h-3" />
                                  No donations yet
                                </span>
                              )}
                              {entry.belowContactQuota && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-warning-light text-warning">
                                  <Target className="w-3 h-3" />
                                  {entry.contactsRemaining} more contact
                                  {entry.contactsRemaining === 1 ? "" : "s"}{" "}
                                  needed
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 pt-4 border-t text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-8 border-b-2 border-dashed border-primary-400" />
                    Public top-{publicLimit} cutoff
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded bg-warning-light border border-warning" />
                    Needs attention ($0 raised
                    {quotaTracked ? " or under contact quota" : ""})
                  </span>
                  <span className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                    Not shown on the public board
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
