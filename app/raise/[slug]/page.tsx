"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Campaign Not Found</h1>
          <p className="text-muted-foreground mb-4">{error || "This campaign does not exist or has been removed."}</p>
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

  return (
    <div className="min-h-screen bg-muted">
      <Suspense fallback={null}>
        <ReferralTracker />
      </Suspense>

      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-display font-bold text-sm leading-none">BB</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Bleacher Backers</span>
            </Link>
            <Button asChild>
              <Link href={`/raise/${params.slug}/donate`}>Donate to the team</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Banner */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 h-64 relative">
        {campaign.bannerImageUrl ? (
          <>
            <img
              src={campaign.bannerImageUrl}
              alt={campaign.teamName}
              className="w-full h-full object-cover"
            />
            {/* The page still needs exactly one h1 when a banner photo replaces
                the typographic treatment; the scrim keeps it readable. */}
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-6">
              <div className="text-white">
                <h1 className="text-3xl sm:text-4xl font-bold">{campaign.teamName}</h1>
                <p className="text-lg mt-1 text-white/80">{campaign.organizationName}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold">{campaign.teamName}</h1>
              <p className="text-xl mt-2 text-primary-100">{campaign.organizationName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      {/*
        `relative z-10` is load-bearing, not decoration. -mt-16 lifts this card
        into the banner above, but that banner is `relative` and this container
        was static — and CSS paints positioned elements above non-positioned
        ones regardless of source order. The banner therefore covered the top
        64px of the card, which is exactly the logo and campaign-title row.
        Stays below the sticky nav's z-50 so the nav still overlays on scroll.
      */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 pb-32 lg:pb-16">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Campaign Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Campaign Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  {campaign.logoUrl ? (
                    <img
                      src={campaign.logoUrl}
                      alt={campaign.teamName}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-3xl font-bold text-primary">
                        {campaign.teamName.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-1">
                      {campaign.organizationName} {campaign.teamName}
                    </CardTitle>
                    <p className="text-muted-foreground">{campaign.category || 'Fundraising Campaign'}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <h3 className="text-xl font-semibold mb-3">About the Campaign</h3>
                  {campaign.description.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-foreground mb-3">{paragraph}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Donors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-warning" />
                  Recent Donors
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaign.donations.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">
                    No donations yet. Be the first to back this team.
                  </p>
                ) : (
                <div className="space-y-4">
                  {campaign.donations.map((donation) => (
                    <div key={donation.id} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">{donation.donorName}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-semibold text-success">
                              {formatCurrency(typeof donation.grossAmount === 'string' ? parseInt(donation.grossAmount) : donation.grossAmount)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatRelativeTime(new Date(donation.createdAt))}
                            </span>
                          </div>
                        </div>
                        {donation.donorMessage && (
                          <p className="text-muted-foreground mt-1 italic">"{donation.donorMessage}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>

            {/* Cheer Wall */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📣 Cheer Wall
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaign.cheerMessages && campaign.cheerMessages.length > 0 ? (
                  <div className="space-y-3">
                    {campaign.cheerMessages.map((message) => (
                      <div key={message.id} className="bg-muted rounded-lg p-4">
                        <p className="text-foreground mb-2">💬 "{message.message}"</p>
                        <p className="text-sm text-muted-foreground">- {message.authorName}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-4 text-muted-foreground">No messages yet. Be the first to cheer them on!</p>
                )}

                <Dialog open={cheerDialogOpen} onOpenChange={setCheerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full mt-4">
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
                          <div className="text-4xl mb-2">🎉</div>
                          <p className="text-success font-semibold">Message submitted!</p>
                          <p className="text-sm text-muted-foreground mt-1">
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
                                className="w-4 h-4"
                              />
                              <Label htmlFor="cheer-anonymous" className="text-sm font-normal cursor-pointer">
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
                              <p className="text-xs text-muted-foreground text-right">
                                {cheerMessage.length}/500 characters
                              </p>
                            </div>
                          </div>

                          {cheerError && (
                            <p
                              role="alert"
                              className="mb-3 rounded-lg border border-warning bg-warning-light px-3 py-2 text-sm text-warning-dark"
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
                <CardTitle>Campaign Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {campaign.updates.map((update) => (
                    <div key={update.id} className="flex items-center gap-3 pb-3 border-b last:border-0">
                      <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{update.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatRelativeTime(new Date(update.publishedAt))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Right Column - Donation Widget.
              order-first puts the donate card above "About the Campaign" on
              phones, where a texted link is the usual way in; at lg the
              source order (info, then widget) takes over again. */}
          <div className="lg:col-span-1 order-first lg:order-none">
            <div className="sticky top-20">
              <Card className="shadow-lg">
                <CardContent className="pt-6">
                  {/* Progress Section */}
                  <div className="mb-6">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-3xl font-bold text-foreground">
                        {formatCurrency(typeof campaign.currentAmount === 'string' ? parseInt(campaign.currentAmount) : campaign.currentAmount)}
                      </span>
                      <span className="text-muted-foreground">
                        of {formatCurrency(typeof campaign.goalAmount === 'string' ? parseInt(campaign.goalAmount) : campaign.goalAmount)}
                      </span>
                    </div>
                    <Progress value={typeof campaign.currentAmount === 'string' ? parseInt(campaign.currentAmount) : campaign.currentAmount} max={typeof campaign.goalAmount === 'string' ? parseInt(campaign.goalAmount) : campaign.goalAmount} className="mb-2" />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="font-semibold text-primary">{percentage}%</span>
                      <span>{campaign.stats?.donorCount || campaign.donorCount || 0} donors</span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{campaign.stats?.donorCount || campaign.donorCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Donors</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{daysLeft}</p>
                      <p className="text-xs text-muted-foreground">Days Left</p>
                    </div>
                  </div>

                  {/* Donate Button */}
                  <Button className="w-full mb-4" size="lg" asChild>
                    <Link href={`/raise/${params.slug}/donate`}>
                      <Heart className="w-4 h-4 mr-2" />
                      Donate Now
                    </Link>
                  </Button>

                  {/* Quick Amounts */}
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-2">A typical gift:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[25, 50, 100].map((quickAmount) => (
                        <Button key={quickAmount} variant="outline" size="sm" asChild>
                          <Link href={`/raise/${params.slug}/donate?amount=${quickAmount}`}>
                            ${quickAmount}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Top Fundraisers */}
                  <Button variant="outline" className="w-full mb-3" asChild>
                    <Link href={`/raise/${params.slug}/leaderboard`}>
                      <Trophy className="w-4 h-4 mr-2" />
                      Top Fundraisers
                    </Link>
                  </Button>

                  {/* Share Button */}
                  <Button variant="outline" className="w-full" onClick={handleShare}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Campaign
                  </Button>
                  {shareNotice && (
                    <p role="status" className="mt-2 text-center text-xs text-muted-foreground">
                      {shareNotice}
                    </p>
                  )}

                  {/* Fee Breakdown */}
                  <div className="mt-6 pt-6 border-t">
                    <details className="cursor-pointer">
                      <summary className="text-sm font-medium text-foreground mb-2">
                        Where does the money go?
                      </summary>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Your gift</span>
                          <span className="font-semibold">${EXAMPLE_DONATION.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Card processing</span>
                          <span className="text-muted-foreground">~${exampleProcessingFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bleacher Backers keeps</span>
                          <span className="text-muted-foreground">${examplePlatformFee.toFixed(2)}</span>
                        </div>
                        <div className="pt-2 border-t flex justify-between">
                          <span className="font-semibold text-foreground">The team receives</span>
                          <span className="font-bold text-success">${exampleNet.toFixed(2)}</span>
                        </div>
                        <p className="pt-2 text-xs text-muted-foreground">
                          Card companies charge a small processing fee. We show it so nothing is a surprise.
                        </p>
                      </div>
                    </details>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile give bar — the donate card scrolls away on a phone, so the
          raised/goal line and the ask stay pinned. Hidden at lg, where the
          sticky widget column already does this job. */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {formatCurrency(currentAmount)}{' '}
              <span className="font-normal text-muted-foreground">
                of {formatCurrency(goalAmount)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{percentage}% of the goal</p>
          </div>
          <Button size="lg" className="flex-shrink-0" asChild>
            <Link href={`/raise/${params.slug}/donate`}>
              <Heart className="w-4 h-4 mr-2" />
              Give now
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
