"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Heart, Share2, Users, Calendar, DollarSign, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatRelativeTime, calculatePercentage, calculateDaysRemaining } from "@/lib/utils";

// Mock data for demo - in production, this will come from Prisma
const getCampaignData = (slug: string) => {
  return {
    id: "1",
    slug,
    organizationName: "Lincoln High School",
    teamName: "Robotics Team",
    description: `Our robotics team is raising funds to compete in the National FIRST Robotics Championship in Detroit. This is an incredible opportunity for our students to showcase their engineering skills and compete against the best teams in the country.

Your support helps us cover competition registration, travel and lodging, robot parts and materials, and team uniforms. Every dollar brings us closer to our dream of competing at nationals and inspiring the next generation of engineers and innovators.

We've been working hard all year designing and building our robot, and we're so excited to take our skills to the national stage!`,
    goalAmount: 1200000, // $12,000 in cents
    currentAmount: 845000, // $8,450 in cents
    platformFeePercent: 10,
    logoUrl: null,
    bannerImageUrl: null,
    primaryColor: "#6366F1",
    secondaryColor: "#F59E0B",
    startDate: new Date("2024-01-15"),
    endDate: new Date("2024-03-15"),
    status: "ACTIVE",
    category: "EDUCATION",
    primaryLeader: {
      firstName: "Alex",
      lastName: "Thompson",
      email: "alex@lincolnrobotics.org",
    },
    donations: [
      {
        id: "1",
        donorName: "Jennifer Martinez",
        grossAmount: 10000,
        donorMessage: "Go Robotics Team! So proud of you all!",
        isAnonymous: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        id: "2",
        donorName: "Anonymous",
        grossAmount: 5000,
        donorMessage: null,
        isAnonymous: true,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      },
      {
        id: "3",
        donorName: "David & Sarah Kim",
        grossAmount: 7500,
        donorMessage: "Can't wait to see you compete!",
        isAnonymous: false,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
    ],
    cheerMessages: [
      {
        id: "1",
        authorName: "Mark Thompson",
        message: "You've got this team! Build something amazing!",
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        id: "2",
        authorName: "Anonymous",
        message: "So excited to support local STEM education!",
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
    ],
    updates: [
      {
        id: "1",
        title: "We finished our robot design!",
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: "2",
        title: "Reached 50% of our goal!",
        publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    ],
    donorCount: 142,
  };
};

export default function CampaignPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const campaign = getCampaignData(params.slug);
  const percentage = calculatePercentage(campaign.currentAmount, campaign.goalAmount);
  const daysLeft = calculateDaysRemaining(campaign.endDate);

  // Track referral clicks
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      // Track the click (don't await, fire and forget)
      fetch('/api/referrals/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: refCode }),
      }).catch(err => console.error('Failed to track referral:', err));
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Rally</span>
            </Link>
            <Button asChild>
              <Link href="/">Start Your Campaign</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Banner */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 h-64 relative">
        {campaign.bannerImageUrl ? (
          <img
            src={campaign.bannerImageUrl}
            alt={campaign.teamName}
            className="w-full h-full object-cover"
          />
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 pb-16">
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
                    <p className="text-gray-600">Building the Future, One Bot at a Time</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <h3 className="text-xl font-semibold mb-3">About the Campaign</h3>
                  {campaign.description.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-gray-700 mb-3">{paragraph}</p>
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
                <div className="space-y-4">
                  {campaign.donations.map((donation) => (
                    <div key={donation.id} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-gray-900">{donation.donorName}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-semibold text-success">
                              {formatCurrency(donation.grossAmount)}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatRelativeTime(donation.createdAt)}
                            </span>
                          </div>
                        </div>
                        {donation.donorMessage && (
                          <p className="text-gray-600 mt-1 italic">"{donation.donorMessage}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4">
                  View All {campaign.donorCount} Donors
                </Button>
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
                <div className="space-y-3">
                  {campaign.cheerMessages.map((message) => (
                    <div key={message.id} className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 mb-2">💬 "{message.message}"</p>
                      <p className="text-sm text-gray-500">- {message.authorName}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4">
                  Leave a Message
                </Button>
              </CardContent>
            </Card>

            {/* Campaign Updates */}
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
                        <p className="font-medium text-gray-900">{update.title}</p>
                        <p className="text-sm text-gray-500">
                          {formatRelativeTime(update.publishedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Donation Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <Card className="shadow-lg">
                <CardContent className="pt-6">
                  {/* Progress Section */}
                  <div className="mb-6">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-3xl font-bold text-gray-900">
                        {formatCurrency(campaign.currentAmount)}
                      </span>
                      <span className="text-gray-600">
                        of {formatCurrency(campaign.goalAmount)}
                      </span>
                    </div>
                    <Progress value={campaign.currentAmount} max={campaign.goalAmount} className="mb-2" />
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span className="font-semibold text-primary">{percentage}%</span>
                      <span>{campaign.donorCount} donors</span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{campaign.donorCount}</p>
                      <p className="text-xs text-gray-600">Donors</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{daysLeft}</p>
                      <p className="text-xs text-gray-600">Days Left</p>
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
                    <p className="text-sm text-gray-600 mb-2">Or donate:</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/raise/${params.slug}/donate`}>$25</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/raise/${params.slug}/donate`}>$50</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/raise/${params.slug}/donate`}>$100</Link>
                      </Button>
                    </div>
                  </div>

                  {/* Tax Deductible Badge */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <div className="w-5 h-5 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Tax-deductible</span>
                  </div>

                  {/* Share Button */}
                  <Button variant="outline" className="w-full">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Campaign
                  </Button>

                  {/* Fee Breakdown */}
                  <div className="mt-6 pt-6 border-t">
                    <details className="cursor-pointer">
                      <summary className="text-sm font-medium text-gray-700 mb-2">
                        Where does my donation go?
                      </summary>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Your donation:</span>
                          <span className="font-semibold">$100.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Platform fee (10%):</span>
                          <span className="text-gray-600">$10.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Processing fee (~3%):</span>
                          <span className="text-gray-600">$3.00</span>
                        </div>
                        <div className="pt-2 border-t flex justify-between">
                          <span className="font-semibold text-gray-900">To campaign:</span>
                          <span className="font-bold text-success">$87.00</span>
                        </div>
                      </div>
                    </details>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
