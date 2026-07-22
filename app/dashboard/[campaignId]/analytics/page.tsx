"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Users, DollarSign, Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, calculatePercentage } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Units: the analytics API returns every money value as a number of DOLLARS
 * (see app/api/campaigns/[campaignId]/analytics/route.ts). formatCurrency()
 * expects CENTS, so dollar values are converted with toCents() before display.
 */
const toCents = (dollars: number) => Math.round(Number(dollars) * 100);

interface Campaign {
  id: string;
  slug: string;
  organizationName: string;
  teamName: string;
  /** dollars */
  goalAmount: number;
  /** dollars */
  currentAmount: number;
  createdAt: string;
}

interface Donation {
  id: string;
  /** dollars */
  grossAmount: number;
  donorName: string | null;
  createdAt: string;
  teamMemberId: string | null;
}

interface Analytics {
  campaign: Campaign;
  donations: Donation[];
  uniqueDonorCount: number;
  /** amount in dollars */
  dailyData: Array<{ date: string; amount: number; count: number }>;
  /** amount in dollars */
  teamMemberStats: Array<{ name: string; amount: number; count: number }>;
  /** value in dollars */
  donationSizeBreakdown: Array<{ range: string; count: number; value: number }>;
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

export default function AnalyticsPage() {
  const params = useParams();
  const campaignId = params?.campaignId as string;
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [campaignId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}/analytics`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Analytics Not Available</h1>
          <Button asChild>
            <Link href={`/dashboard/${campaignId}`}>Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const {
    campaign,
    donations,
    uniqueDonorCount,
    dailyData,
    teamMemberStats,
    donationSizeBreakdown,
  } = analytics;
  // API values are dollars; everything below works in cents for formatCurrency.
  const goalAmount = toCents(campaign.goalAmount);
  const currentAmount = toCents(campaign.currentAmount);
  const percentage = calculatePercentage(currentAmount, goalAmount);
  const averageDonation = donations.length > 0 ? currentAmount / donations.length : 0;

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={`/dashboard/${campaignId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Campaign Analytics
              </h1>
              <p className="text-muted-foreground">
                {campaign.organizationName} {campaign.teamName}
              </p>
            </div>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                Total Raised
                <DollarSign className="w-5 h-5 text-success" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(currentAmount)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {percentage}% of {formatCurrency(goalAmount)} goal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                Total Donations
                <TrendingUp className="w-5 h-5 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {donations.length}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {donations.filter(d => {
                  const date = new Date(d.createdAt);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return date > weekAgo;
                }).length} this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                Average Donation
                <DollarSign className="w-5 h-5 text-secondary" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(Math.round(averageDonation))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                per donation
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                Unique Donors
                <Users className="w-5 h-5 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {uniqueDonorCount}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                supporters
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Donations Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Donations Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis
                    yAxisId="amount"
                    tickFormatter={(v: any) => `$${Math.round(Number(v)).toLocaleString()}`}
                  />
                  <YAxis yAxisId="count" orientation="right" allowDecimals={false} />
                  <Tooltip
                    formatter={(value: any, name: string, item: any) => {
                      // dailyData amounts are dollars (API convention)
                      if (item?.dataKey === "amount" || name === "Amount Raised") {
                        return [formatCurrency(toCents(Number(value))), "Amount Raised"];
                      }
                      return [value, "Number of Donations"];
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#6366f1"
                    strokeWidth={2}
                    name="Amount Raised"
                    yAxisId="amount"
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Number of Donations"
                    yAxisId="count"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Fundraisers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Fundraisers</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamMemberStats.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis
                    tickFormatter={(v: any) => `$${Math.round(Number(v)).toLocaleString()}`}
                  />
                  <Tooltip
                    formatter={(value: any) => [
                      formatCurrency(toCents(Number(value))),
                      "Amount Raised",
                    ]}
                  />
                  <Bar dataKey="amount" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Donation Size Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Donation Size Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={donationSizeBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.range}: ${entry.count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {donationSizeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Campaign Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Goal Progress</span>
                    <span className="text-2xl font-bold text-primary">{percentage}%</span>
                  </div>
                  <div className="w-full bg-accent rounded-full h-4">
                    <div
                      className="bg-gradient-to-r from-primary to-secondary rounded-full h-4 transition-all duration-500"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                    <span>{formatCurrency(currentAmount)} raised</span>
                    <span>{formatCurrency(goalAmount)} goal</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">Remaining to Goal</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatCurrency(Math.max(0, goalAmount - currentAmount))}
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">Days Active</div>
                    <div className="text-2xl font-bold text-foreground">
                      {Math.floor(
                        (new Date().getTime() - new Date(campaign.createdAt).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-2">
                    Average Daily Performance
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {formatCurrency(
                      Math.round(
                        currentAmount /
                          Math.max(
                            1,
                            Math.floor(
                              (new Date().getTime() - new Date(campaign.createdAt).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                          )
                      )
                    )}
                    <span className="text-sm font-normal text-muted-foreground ml-1">per day</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Member Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Team Member Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Name</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Amount Raised</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Donations</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Avg. Donation</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMemberStats.map((member, index) => (
                    <tr key={index} className="border-b hover:bg-muted">
                      <td className="py-3 px-4">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0
                              ? "bg-yellow-100 text-yellow-700"
                              : index === 1
                              ? "bg-muted text-foreground"
                              : index === 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">{member.name}</td>
                      <td className="py-3 px-4 text-right font-semibold text-foreground">
                        {formatCurrency(toCents(member.amount))}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{member.count}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {formatCurrency(Math.round(toCents(member.amount) / member.count))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
