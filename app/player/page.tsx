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
import { formatCurrency, calculatePercentage } from "@/lib/utils";

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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const copyReferralLink = (code: string, slug: string) => {
    const link = `${window.location.origin}/raise/${slug}?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const shareOnSocial = (platform: string, code: string, slug: string, teamName: string) => {
    const link = `${window.location.origin}/raise/${slug}?ref=${code}`;
    const message = `Help me reach my fundraising goal for ${teamName}!`;

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
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <p className="text-warning mb-4">{error || 'Failed to load data'}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Rally</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {data.user.firstName} {data.user.lastName}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {data.user.firstName}! 👋
          </h1>
          <p className="text-muted-foreground">Track your fundraising progress and share your links</p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Raised
              </CardTitle>
              <DollarSign className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(data.stats.totalRaised)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Across all campaigns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Donations
              </CardTitle>
              <Users className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {data.stats.totalDonations}
              </div>
              <p className="text-sm text-muted-foreground mt-1">People supported you</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Link Clicks
              </CardTitle>
              <MousePointer className="w-5 h-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {data.stats.totalClicks}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Total engagement</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Campaigns
              </CardTitle>
              <Trophy className="w-5 h-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {data.stats.campaignCount}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Teams you're on</p>
            </CardContent>
          </Card>
        </div>

        {/* My Campaigns */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4">My Campaigns</h2>

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
                            <span className="text-sm font-medium text-foreground">
                              Your Progress
                            </span>
                            <span className="text-sm font-semibold text-primary">
                              {formatCurrency(parseInt(membership.amountRaised))}
                              {membership.personalGoal && (
                                <span className="text-muted-foreground font-normal">
                                  {' '}/ {formatCurrency(parseInt(membership.personalGoal))}
                                </span>
                              )}
                            </span>
                          </div>
                          {membership.personalGoal && (
                            <div className="w-full bg-accent rounded-full h-2 mb-1">
                              <div
                                className="bg-primary rounded-full h-2 transition-all"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Referral Stats */}
                        {membership.referral && (
                          <div className="bg-muted rounded-lg p-4">
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-foreground">
                                  {membership.referral.clickCount}
                                </p>
                                <p className="text-xs text-muted-foreground">Clicks</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-success">
                                  {membership.referral.donationCount}
                                </p>
                                <p className="text-xs text-muted-foreground">Donations</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-primary">
                                  {membership.referral.donationCount > 0
                                    ? ((membership.referral.donationCount / membership.referral.clickCount) * 100).toFixed(1)
                                    : 0}%
                                </p>
                                <p className="text-xs text-muted-foreground">Conversion</p>
                              </div>
                            </div>

                            {/* Share Links */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  readOnly
                                  value={`${window.location.origin}/raise/${membership.campaign.slug}?ref=${membership.referral.code}`}
                                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-white"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    copyReferralLink(membership.referral!.code, membership.campaign.slug)
                                  }
                                >
                                  {copiedCode === membership.referral.code ? (
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() =>
                                    shareOnSocial(
                                      'facebook',
                                      membership.referral!.code,
                                      membership.campaign.slug,
                                      membership.campaign.teamName
                                    )
                                  }
                                >
                                  <Share2 className="w-4 h-4 mr-1" />
                                  Facebook
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() =>
                                    shareOnSocial(
                                      'twitter',
                                      membership.referral!.code,
                                      membership.campaign.slug,
                                      membership.campaign.teamName
                                    )
                                  }
                                >
                                  <Share2 className="w-4 h-4 mr-1" />
                                  Twitter
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() =>
                                    shareOnSocial(
                                      'email',
                                      membership.referral!.code,
                                      membership.campaign.slug,
                                      membership.campaign.teamName
                                    )
                                  }
                                >
                                  <Share2 className="w-4 h-4 mr-1" />
                                  Email
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
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
