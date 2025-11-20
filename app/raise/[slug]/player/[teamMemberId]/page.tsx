"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  DollarSign,
  Heart,
  Share2,
  Copy,
  Check,
  Loader2,
  Target,
  TrendingUp,
  Users,
  Facebook,
  Twitter,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, calculatePercentage } from "@/lib/utils";
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
  const [showDonateForm, setShowDonateForm] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/raise/${params.slug}/player/${params.teamMemberId}?ref=${data?.referralCode || ''}`
    : '';

  useEffect(() => {
    fetchPlayerData();
  }, [params.teamMemberId]);

  const fetchPlayerData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/team-members/${params.teamMemberId}/public`
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
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading player page...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Player not found"}</p>
          <Button onClick={() => router.push(`/raise/${params.slug}`)}>
            Go to Campaign Page
          </Button>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Rally</span>
            </Link>
            <Button
              onClick={() => setShowDonateForm(true)}
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              <Heart className="w-5 h-5 mr-2" />
              Donate Now
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative">
        {data.campaign.bannerImageUrl ? (
          <div className="h-48 md:h-64 w-full overflow-hidden">
            <Image
              src={data.campaign.bannerImageUrl}
              alt="Campaign banner"
              width={1920}
              height={400}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="h-48 md:h-64 w-full"
            style={{
              background: `linear-gradient(135deg, ${data.campaign.primaryColor} 0%, ${data.campaign.primaryColor}dd 100%)`
            }}
          />
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Player Profile Card */}
        <div className="relative -mt-20 mb-8">
          <Card className="overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Profile Photo */}
                <div className="flex-shrink-0">
                  {data.teamMember.profilePhotoUrl ? (
                    <Image
                      src={data.teamMember.profilePhotoUrl}
                      alt={data.teamMember.name}
                      width={160}
                      height={160}
                      className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center border-4 border-white shadow-lg">
                      <span className="text-5xl font-bold text-white">
                        {data.teamMember.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Player Info */}
                <div className="flex-1">
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                    {data.teamMember.name}
                  </h1>
                  <p className="text-lg text-gray-600 mb-4">
                    {data.campaign.organizationName} {data.campaign.teamName}
                  </p>

                  <div className="flex flex-wrap gap-4 mb-4">
                    {data.teamMember.position && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Target className="w-4 h-4" />
                        {data.teamMember.position}
                      </div>
                    )}
                    {data.teamMember.grade && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        {data.teamMember.grade}
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Fundraising Progress
                      </span>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(parseInt(data.teamMember.amountRaised))}
                        {data.teamMember.personalGoal && (
                          <span className="text-lg text-gray-600 font-normal">
                            {" "}/ {formatCurrency(parseInt(data.teamMember.personalGoal))}
                          </span>
                        )}
                      </span>
                    </div>
                    {data.teamMember.personalGoal && (
                      <div className="w-full bg-gray-200 rounded-full h-4 mb-1">
                        <div
                          className="bg-gradient-to-r from-primary to-secondary rounded-full h-4 transition-all flex items-center justify-end pr-2"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        >
                          {percentage >= 10 && (
                            <span className="text-xs font-bold text-white">
                              {percentage}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-gray-600">
                      {data.stats.donationCount} {data.stats.donationCount === 1 ? 'donation' : 'donations'} • {data.stats.clickCount} page views
                    </p>
                  </div>

                  {/* Share Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyShareLink}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Link
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('facebook')}
                    >
                      <Facebook className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('twitter')}
                    >
                      <Twitter className="w-4 h-4 mr-2" />
                      Tweet
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('email')}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('sms')}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Text
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video */}
            {data.teamMember.profileVideoUrl && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    My Story
                  </h2>
                  <div className="aspect-video rounded-lg overflow-hidden">
                    <video
                      src={data.teamMember.profileVideoUrl}
                      controls
                      className="w-full h-full"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Personal Story */}
            {data.teamMember.personalStory && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    About Me
                  </h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="whitespace-pre-wrap text-gray-700">
                      {data.teamMember.personalStory}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Favorite Quote */}
            {data.teamMember.favoriteQuote && (
              <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-l-4 border-primary">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="text-6xl text-primary/20 leading-none">"</div>
                    <div className="flex-1">
                      <p className="text-lg italic text-gray-700 mb-2">
                        {data.teamMember.favoriteQuote}
                      </p>
                      <p className="text-sm text-gray-600">
                        - {data.teamMember.name}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Donations */}
            {data.recentDonations.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-500" />
                    Recent Supporters
                  </h2>
                  <div className="space-y-4">
                    {data.recentDonations.slice(0, 10).map((donation) => (
                      <div
                        key={donation.id}
                        className="flex items-start gap-4 pb-4 border-b last:border-0"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                          <Heart className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900">
                              {donation.isAnonymous
                                ? "Anonymous"
                                : donation.donorName || "Donor"}
                            </span>
                            <span className="font-bold text-primary">
                              {formatCurrency(parseInt(donation.grossAmount))}
                            </span>
                          </div>
                          {donation.donorMessage && (
                            <p className="text-sm text-gray-600 italic">
                              "{donation.donorMessage}"
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(donation.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Donate Box */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Support {data.teamMember.name}
                  </h3>
                  <DonationForm
                    campaignId={data.campaign.id}
                    campaignSlug={data.campaign.slug}
                    referralCode={data.referralCode}
                    defaultMessage={`Go ${data.teamMember.name}!`}
                  />
                </CardContent>
              </Card>

              {/* Campaign Info */}
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    About the Campaign
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    {data.campaign.description}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    asChild
                  >
                    <Link href={`/raise/${data.campaign.slug}`}>
                      View Full Campaign
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            Powered by <span className="font-bold text-white">Rally</span> - Fundraising Reimagined
          </p>
        </div>
      </footer>
    </div>
  );
}
