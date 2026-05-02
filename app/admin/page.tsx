"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  Wallet,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AdminStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalDonations: number;
  totalRaised: number;
  averageDonation: number;
  platformFees: number;
  totalDisbursed: number;
  pendingDisbursements: number;
  pendingDisbursementAmount: number;
  uniqueDonors: number;
  totalUsers: number;
  growth: {
    donations: {
      percentage: number;
      trend: string;
    };
    donationCount: {
      percentage: number;
      trend: string;
    };
  };
  topCampaigns: Array<{
    id: string;
    name: string;
    slug: string;
    raised: number;
    goal: number;
    percentage: number;
    donationCount: number;
  }>;
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    progress: {
      goal: number;
      raised: number;
      percentage: number;
    };
    createdAt: string;
  }>;
}

interface PendingDisbursement {
  id: string;
  campaignId: string;
  requestedAmount: number;
  purpose: string;
  requestedAt: string;
  requestedByUser: {
    firstName: string;
    lastName: string;
  };
  bankingAccount: {
    campaign: {
      teamName: string;
      organizationName: string;
    };
  };
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingDisbursements, setPendingDisbursements] = useState<PendingDisbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch admin stats and pending disbursements in parallel
        const [statsRes, disbursementsRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/disbursements?status=PENDING&limit=3')
        ]);

        if (!statsRes.ok || !disbursementsRes.ok) {
          throw new Error('Failed to fetch admin data');
        }

        const statsData = await statsRes.json();
        const disbursementsData = await disbursementsRes.json();

        if (statsData.success) {
          setStats(statsData.stats);
        }

        if (disbursementsData.success) {
          setPendingDisbursements(disbursementsData.requests || []);
        }

        setError(null);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
        setError('Failed to load admin dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Failed to load dashboard</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Overview</h1>
        <p className="text-gray-600">
          Platform-wide statistics and recent activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Raised
            </CardTitle>
            <DollarSign className="w-5 h-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(stats.totalRaised * 100)}
            </div>
            <p className={`text-sm mt-1 flex items-center ${stats.growth.donations.trend === 'up' ? 'text-success' : stats.growth.donations.trend === 'down' ? 'text-destructive' : 'text-gray-500'}`}>
              {stats.growth.donations.trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : stats.growth.donations.trend === 'down' ? <ArrowDownRight className="w-3 h-3 mr-1" /> : null}
              {stats.growth.donations.percentage > 0 ? '+' : ''}{stats.growth.donations.percentage.toFixed(1)}% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Campaigns
            </CardTitle>
            <Activity className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.activeCampaigns}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {stats.totalCampaigns} total campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Platform Fees
            </CardTitle>
            <Wallet className="w-5 h-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(stats.platformFees * 100)}
            </div>
            <p className="text-sm text-gray-500 mt-1">10% of total raised</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Users
            </CardTitle>
            <Users className="w-5 h-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totalUsers.toLocaleString()}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {stats.uniqueDonors} unique donors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Donations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {stats.totalDonations.toLocaleString()}
              </span>
              <span className={`text-sm flex items-center ${stats.growth.donationCount.trend === 'up' ? 'text-success' : stats.growth.donationCount.trend === 'down' ? 'text-destructive' : 'text-gray-500'}`}>
                {stats.growth.donationCount.trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : stats.growth.donationCount.trend === 'down' ? <ArrowDownRight className="w-3 h-3 mr-1" /> : null}
                {stats.growth.donationCount.percentage > 0 ? '+' : ''}{stats.growth.donationCount.percentage.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-warning">
                {stats.pendingDisbursements}
              </span>
              <Button variant="link" size="sm" asChild className="p-0 h-auto">
                <Link href="/admin/disbursements">Review now →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Donation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.averageDonation * 100)}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Activity & Top Campaigns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentCampaigns && stats.recentCampaigns.length > 0 ? (
                  stats.recentCampaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                    >
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {campaign.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                            campaign.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                            campaign.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {campaign.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {campaign.progress.percentage}% of goal
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(new Date(campaign.createdAt))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(campaign.progress.raised * 100)}
                        </p>
                        <p className="text-xs text-gray-500">
                          of {formatCurrency(campaign.progress.goal * 100)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No recent campaigns
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Campaigns */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Top Performing Campaigns
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/campaigns">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.topCampaigns && stats.topCampaigns.length > 0 ? (
                  stats.topCampaigns.slice(0, 5).map((campaign, index) => {
                    return (
                      <div key={campaign.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gray-400">
                              #{index + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {campaign.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {campaign.donationCount} donations
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(campaign.raised * 100)}
                            </p>
                            <p className="text-xs text-gray-500">
                              of {formatCurrency(campaign.goal * 100)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary rounded-full h-2 transition-all"
                              style={{ width: `${Math.min(campaign.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-primary">
                            {campaign.percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No active campaigns
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Pending Approvals */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertCircle className="w-5 h-5" />
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingDisbursements.length > 0 ? (
                  pendingDisbursements.map((disbursement) => (
                    <div
                      key={disbursement.id}
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(Number(disbursement.requestedAmount) * 100)}
                        </p>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                          Pending
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {disbursement.bankingAccount.campaign.teamName} - {disbursement.bankingAccount.campaign.organizationName}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">{disbursement.purpose}</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Requested by: {disbursement.requestedByUser.firstName} {disbursement.requestedByUser.lastName}</p>
                        <p>{formatRelativeTime(new Date(disbursement.requestedAt))}</p>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="flex-1" asChild>
                          <Link href={`/admin/disbursements?id=${disbursement.id}`}>
                            Review
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                      No pending approvals
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
