"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  ArrowUpRight,
  Users,
  Calendar,
  Download,
  Send,
  BarChart3,
  Settings,
  Eye,
  Share2,
  AlertCircle,
  Check,
  Clock,
  Loader2,
  RefreshCw,
  UserPlus,
  Trophy,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCampaignData } from "@/lib/hooks/useCampaignData";
import { formatCurrency } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function EnhancedDashboardPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const router = useRouter();
  const { campaign, statistics, recentDonations, stats, isLoading, error, refresh } = useCampaignData(params?.campaignId);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading campaign dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertCircle className="mr-2" />
              Error Loading Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/dashboard')}>
              Back to Campaigns
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!campaign) return null;

  const progress = campaign.progress || 0;
  const daysRemaining = campaign.daysRemaining || 0;
  const trendIcon = stats?.trends?.weekOverWeek?.direction === 'up' ?
    <TrendingUp className="w-4 h-4 text-green-600" /> :
    stats?.trends?.weekOverWeek?.direction === 'down' ?
    <TrendingDown className="w-4 h-4 text-red-600" /> :
    <Minus className="w-4 h-4 text-gray-600" />;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {campaign.teamName} - {campaign.organizationName}
            </h1>
            <p className="text-muted-foreground">{campaign.description}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/raise/${campaign.slug}`} target="_blank">
                <Eye className="mr-2 h-4 w-4" />
                View Public Page
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/dashboard/${params?.campaignId}/roster`}>
                <UserPlus className="mr-2 h-4 w-4" />
                Manage Roster
              </Link>
            </Button>
          </div>
        </div>

        {/* Campaign Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between mb-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(campaign.totalRaised)}</p>
                <p className="text-sm text-muted-foreground">
                  raised of {formatCurrency(campaign.goalAmount)} goal
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{Math.round(progress)}%</p>
                <p className="text-sm text-muted-foreground">complete</p>
              </div>
            </div>
            <Progress value={progress} className="h-2 mb-4" />
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{statistics?.uniqueDonorCount || 0} donors</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{daysRemaining} days remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Raised</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(campaign.totalRaised)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {trendIcon}
              <span className="ml-1">
                {stats?.trends?.weekOverWeek?.percentage}% from last week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.teamMemberCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active fundraisers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Donation</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(statistics?.averageDonation || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Donations</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.donationCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total contributions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        {/* Donations Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Donations Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.donationsByDay && stats.donationsByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.donationsByDay.slice(0, 30).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#8884d8"
                    name="Amount Raised"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No donation data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Fundraisers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Fundraisers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.topPlayers?.map((player: any, index: number) => (
                <div key={player.id} className="flex items-center">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      {index === 0 ? (
                        <Trophy className="w-4 h-4 text-yellow-600" />
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{player.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {player.position || player.grade || 'Team Member'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(player.amountRaised)}</p>
                    {player.personalGoal && (
                      <p className="text-xs text-muted-foreground">
                        {Math.round(player.percentageOfGoal)}% of goal
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {(!stats?.topPlayers || stats.topPlayers.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No team members yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Donations Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Donations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentDonations.map((donation) => (
              <div key={donation.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {donation.donorInitials}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{donation.donorName}</p>
                    <p className="text-sm text-muted-foreground">
                      {donation.teamMember ? `to ${donation.teamMember.name}` : 'to campaign'}
                      {donation.message && ` • "${donation.message}"`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(donation.amount)}</p>
                  <p className="text-xs text-muted-foreground">{donation.timeAgo}</p>
                </div>
              </div>
            ))}
            {recentDonations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No donations yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}