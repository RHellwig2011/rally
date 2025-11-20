"use client";

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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Mock data - will be replaced with real database queries
const getAdminOverview = () => {
  return {
    platformStats: {
      totalRaised: 5420000, // $54,200
      totalFees: 542000, // $5,420 (10%)
      activeCampaigns: 28,
      totalUsers: 1847,
      pendingDisbursements: 12,
      totalDonations: 3284,
    },
    trends: {
      raisedChange: 18.5,
      campaignsChange: 12.3,
      usersChange: 24.7,
      donationsChange: 15.2,
    },
    recentActivity: [
      {
        id: "1",
        type: "campaign_created",
        campaign: "Lincoln High Robotics",
        user: "Alex Thompson",
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
      {
        id: "2",
        type: "large_donation",
        campaign: "West Valley Soccer",
        amount: 50000,
        donor: "Anonymous",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: "3",
        type: "disbursement_approved",
        campaign: "Central Arts Program",
        amount: 25000,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
      {
        id: "4",
        type: "goal_reached",
        campaign: "East Side Band Trip",
        amount: 800000,
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
      {
        id: "5",
        type: "disbursement_pending",
        campaign: "North High Tennis",
        amount: 35000,
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
    ],
    topCampaigns: [
      {
        id: "1",
        name: "Lincoln High Robotics",
        organization: "Lincoln High School",
        raised: 845000,
        goal: 1200000,
        donors: 142,
      },
      {
        id: "2",
        name: "West Valley Soccer",
        organization: "West Valley Middle School",
        raised: 680000,
        goal: 750000,
        donors: 98,
      },
      {
        id: "3",
        name: "Central Arts Program",
        organization: "Central Elementary",
        raised: 520000,
        goal: 600000,
        donors: 187,
      },
    ],
    pendingApprovals: [
      {
        id: "1",
        campaign: "Lincoln High Robotics",
        amount: 50000,
        purpose: "Travel Deposit",
        requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        requestedBy: "Alex Thompson",
      },
      {
        id: "2",
        campaign: "North High Tennis",
        amount: 35000,
        purpose: "Equipment Purchase",
        requestedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        requestedBy: "Sarah Johnson",
      },
      {
        id: "3",
        campaign: "West Valley Soccer",
        amount: 28000,
        purpose: "Tournament Registration",
        requestedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
        requestedBy: "Mike Davis",
      },
    ],
  };
};

export default function AdminOverviewPage() {
  const data = getAdminOverview();

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
              {formatCurrency(data.platformStats.totalRaised)}
            </div>
            <p className="text-sm text-success mt-1 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              +{data.trends.raisedChange}% from last month
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
              {data.platformStats.activeCampaigns}
            </div>
            <p className="text-sm text-success mt-1 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              +{data.trends.campaignsChange}% from last month
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
              {formatCurrency(data.platformStats.totalFees)}
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
              {data.platformStats.totalUsers.toLocaleString()}
            </div>
            <p className="text-sm text-success mt-1 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              +{data.trends.usersChange}% from last month
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
                {data.platformStats.totalDonations.toLocaleString()}
              </span>
              <span className="text-sm text-success flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +{data.trends.donationsChange}%
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
                {data.platformStats.pendingDisbursements}
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
              Avg Campaign Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-gray-900">
              {formatCurrency(
                Math.floor(
                  data.platformStats.totalRaised / data.platformStats.activeCampaigns
                )
              )}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Activity & Top Campaigns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Platform Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {activity.type === "campaign_created" && (
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      {activity.type === "large_donation" && (
                        <div className="w-8 h-8 rounded-full bg-success-100 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-success" />
                        </div>
                      )}
                      {activity.type === "disbursement_approved" && (
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                      {activity.type === "goal_reached" && (
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-purple-600" />
                        </div>
                      )}
                      {activity.type === "disbursement_pending" && (
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-warning" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      {activity.type === "campaign_created" && (
                        <>
                          <p className="text-sm text-gray-900">
                            <span className="font-semibold">{activity.user}</span>{" "}
                            created a new campaign
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {activity.campaign}
                          </p>
                        </>
                      )}
                      {activity.type === "large_donation" && (
                        <>
                          <p className="text-sm text-gray-900">
                            <span className="font-semibold">{activity.donor}</span>{" "}
                            donated{" "}
                            <span className="font-semibold text-success">
                              {formatCurrency(activity.amount)}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            to {activity.campaign}
                          </p>
                        </>
                      )}
                      {activity.type === "disbursement_approved" && (
                        <>
                          <p className="text-sm text-gray-900">
                            Disbursement approved for{" "}
                            <span className="font-semibold">
                              {formatCurrency(activity.amount)}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {activity.campaign}
                          </p>
                        </>
                      )}
                      {activity.type === "goal_reached" && (
                        <>
                          <p className="text-sm text-gray-900">
                            <span className="font-semibold">{activity.campaign}</span>{" "}
                            reached their goal!
                          </p>
                          <p className="text-sm text-success mt-1">
                            {formatCurrency(activity.amount)} raised
                          </p>
                        </>
                      )}
                      {activity.type === "disbursement_pending" && (
                        <>
                          <p className="text-sm text-gray-900">
                            Disbursement pending approval{" "}
                            <span className="font-semibold">
                              {formatCurrency(activity.amount)}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {activity.campaign}
                          </p>
                        </>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
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
                {data.topCampaigns.map((campaign, index) => {
                  const percentage = Math.round(
                    (campaign.raised / campaign.goal) * 100
                  );
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
                              {campaign.organization}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(campaign.raised)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {campaign.donors} donors
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2 transition-all"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
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
                {data.pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(approval.amount)}
                      </p>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        Pending
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      {approval.campaign}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">{approval.purpose}</p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>Requested by: {approval.requestedBy}</p>
                      <p>{formatRelativeTime(approval.requestedAt)}</p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1" asChild>
                        <Link href={`/admin/disbursements?id=${approval.id}`}>
                          Review
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {data.pendingApprovals.length === 0 && (
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
