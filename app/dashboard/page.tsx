"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatRelativeTime, calculatePercentage } from "@/lib/utils";

interface Campaign {
  id: string;
  organizationName: string;
  teamName: string;
  slug: string;
  goalAmount: number;
  currentAmount: number;
  status: string;
  startDate: Date;
  endDate: Date | null;
  primaryLeader: {
    firstName: string;
    lastName: string;
  };
  bankingAccount: {
    totalRaised: number;
    availableBalance: number;
  };
}

export default function CampaignsListPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/campaigns');
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?redirect=/dashboard');
          return;
        }
        throw new Error(data.error || 'Failed to fetch campaigns');
      }

      // Convert string amounts to numbers
      const campaignsData = data.campaigns.map((c: any) => ({
        ...c,
        goalAmount: parseInt(c.goalAmount),
        currentAmount: parseInt(c.currentAmount),
        startDate: new Date(c.startDate),
        endDate: c.endDate ? new Date(c.endDate) : null,
        bankingAccount: c.bankingAccount ? {
          totalRaised: parseInt(c.bankingAccount.totalRaised),
          availableBalance: parseInt(c.bankingAccount.availableBalance),
        } : null,
      }));

      setCampaigns(campaignsData);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">R</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">Rally</span>
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-11 w-40 bg-gray-200 rounded animate-pulse" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

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
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Campaigns</h1>
            <p className="text-gray-600">
              Manage your fundraising campaigns and track progress
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/create-campaign">
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Link>
          </Button>
        </div>

        {/* Campaigns Grid */}
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No campaigns yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Get started by creating your first fundraising campaign
                </p>
                <Button asChild>
                  <Link href="/create-campaign">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Campaign
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => {
              const percentage = calculatePercentage(
                campaign.currentAmount,
                campaign.goalAmount
              );

              const daysLeft = campaign.endDate
                ? Math.ceil(
                    (campaign.endDate.getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                : null;

              return (
                <Card
                  key={campaign.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/dashboard/${campaign.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">
                          {campaign.teamName}
                        </CardTitle>
                        <p className="text-sm text-gray-600">
                          {campaign.organizationName}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          campaign.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(campaign.currentAmount)}
                          </span>
                          <span className="text-gray-600">
                            of {formatCurrency(campaign.goalAmount)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2 transition-all"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {percentage}% raised
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-success" />
                          <div>
                            <p className="text-xs text-gray-600">Available</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {campaign.bankingAccount
                                ? formatCurrency(campaign.bankingAccount.availableBalance)
                                : '$0.00'}
                            </p>
                          </div>
                        </div>
                        {daysLeft !== null && daysLeft >= 0 && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <div>
                              <p className="text-xs text-gray-600">Days Left</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {daysLeft}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* View Button */}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push(`/dashboard/${campaign.id}`)}
                      >
                        View Dashboard
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
