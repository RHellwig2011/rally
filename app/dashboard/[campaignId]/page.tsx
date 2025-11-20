"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatRelativeTime, calculatePercentage } from "@/lib/utils";

interface DashboardData {
  campaign: any;
  bankingAccount: any;
  recentDonations: any[];
  disbursementRequests: any[];
  teamMembers: any[];
  stats: any;
}

export default function DashboardPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [disbursementForm, setDisbursementForm] = useState({
    amount: "",
    purpose: "",
    description: "",
  });

  useEffect(() => {
    fetchDashboardData();
  }, [params.campaignId]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/campaigns/${params.campaignId}`);
      const result = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?redirect=/dashboard/' + params.campaignId);
          return;
        }
        throw new Error(result.error || 'Failed to fetch campaign data');
      }

      // Convert string amounts to numbers for calculations
      const dashboardData: DashboardData = {
        campaign: {
          ...result.data.campaign,
          goalAmount: parseInt(result.data.campaign.goalAmount),
          currentAmount: parseInt(result.data.campaign.currentAmount),
        },
        bankingAccount: result.data.bankingAccount ? {
          totalRaised: parseInt(result.data.bankingAccount.totalRaised),
          platformFeesCollected: parseInt(result.data.bankingAccount.platformFeesCollected),
          availableBalance: parseInt(result.data.bankingAccount.availableBalance),
          disbursedTotal: parseInt(result.data.bankingAccount.disbursedTotal),
          pendingDisbursement: parseInt(result.data.bankingAccount.pendingDisbursement),
        } : null,
        recentDonations: result.data.recentDonations.map((d: any) => ({
          ...d,
          grossAmount: parseInt(d.grossAmount),
          createdAt: new Date(d.createdAt),
        })),
        disbursementRequests: result.data.disbursementRequests.map((dr: any) => ({
          ...dr,
          requestedAmount: parseInt(dr.requestedAmount),
          requestedAt: new Date(dr.requestedAt),
          approvedAt: dr.approvedAt ? new Date(dr.approvedAt) : null,
          disbursementDate: dr.disbursementDate ? new Date(dr.disbursementDate) : null,
        })),
        teamMembers: result.data.teamMembers,
        stats: result.data.stats,
      };

      setData(dashboardData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisbursementRequest = () => {
    console.log("Disbursement request:", disbursementForm);
    alert("Disbursement request submitted! (Will save to database once connected)");
    setIsRequestDialogOpen(false);
    setDisbursementForm({ amount: "", purpose: "", description: "" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Campaign</h2>
          <p className="text-gray-600 mb-4">{error || 'Unknown error occurred'}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  const percentage = calculatePercentage(
    data.campaign.currentAmount,
    data.campaign.goalAmount
  );

  const pendingRequests = data.disbursementRequests.filter(dr => dr.status === 'PENDING');
  const completedDisbursements = data.disbursementRequests.filter(
    dr => dr.status === 'COMPLETED' && dr.disbursementDate
  );

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
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/raise/${data.campaign.slug}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Public Page
                </Link>
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary font-semibold text-sm">AT</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Campaign Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {data.campaign.organizationName} {data.campaign.teamName}
          </h1>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" asChild>
              <Link href={`/raise/${data.campaign.slug}`}>
                <Share2 className="w-4 h-4 mr-2" />
                Share Campaign
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${params.campaignId}/roster`}>
                <Users className="w-4 h-4 mr-2" />
                Manage Roster
              </Link>
            </Button>
            <Button variant="outline" size="sm">
              <Send className="w-4 h-4 mr-2" />
              Send Update
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
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
                {formatCurrency(data.bankingAccount.totalRaised)}
              </div>
              <p className="text-sm text-success mt-1 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12% from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Platform Fee
              </CardTitle>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(data.bankingAccount.platformFeesCollected)}
              </div>
              <p className="text-sm text-gray-500 mt-1">(10%)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Available Balance
              </CardTitle>
              <Wallet className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(data.bankingAccount.availableBalance)}
              </div>
              <p className="text-sm text-gray-500 mt-1">Ready to withdraw</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Disbursed
              </CardTitle>
              <ArrowUpRight className="w-5 h-5 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(data.bankingAccount.disbursedTotal)}
              </div>
              <p className="text-sm text-gray-500 mt-1">Total paid out</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Fundraising Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Fundraising Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Goal Progress</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(data.campaign.currentAmount)} of{" "}
                        {formatCurrency(data.campaign.goalAmount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">{percentage}%</p>
                      <p className="text-sm text-gray-600">Complete</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-primary rounded-full h-3 transition-all"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-4 pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {data.stats.donorCount}
                      </p>
                      <p className="text-xs text-gray-600">Donors</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(data.stats.avgDonation)}
                      </p>
                      <p className="text-xs text-gray-600">Avg Donation</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-success">
                        +{data.stats.newDonorsToday}
                      </p>
                      <p className="text-xs text-gray-600">Today</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {data.stats.daysLeft}
                      </p>
                      <p className="text-xs text-gray-600">Days Left</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Donations */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Recent Donations
                  </CardTitle>
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recentDonations.map((donation) => (
                    <div
                      key={donation.id}
                      className="flex items-start justify-between pb-4 border-b last:border-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {donation.donorName}
                          </p>
                          {donation.donorMessage && (
                            <p className="text-sm text-gray-600 mt-1 italic">
                              "{donation.donorMessage}"
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatRelativeTime(donation.createdAt)}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-success">
                        {formatCurrency(donation.grossAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Banking & Actions */}
          <div className="space-y-6">
            {/* Banking Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Banking & Funds
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Available Balance</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(data.bankingAccount.availableBalance)}
                  </p>
                </div>

                <Dialog
                  open={isRequestDialogOpen}
                  onOpenChange={setIsRequestDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button className="w-full" size="lg">
                      <Wallet className="w-4 h-4 mr-2" />
                      Request Disbursement
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Request Fund Disbursement</DialogTitle>
                      <DialogDescription>
                        Available Balance:{" "}
                        {formatCurrency(data.bankingAccount.availableBalance)}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="amount">Amount to Request *</Label>
                        <div className="flex items-center mt-2">
                          <span className="text-gray-600 mr-2">$</span>
                          <Input
                            id="amount"
                            type="number"
                            placeholder="500"
                            value={disbursementForm.amount}
                            onChange={(e) =>
                              setDisbursementForm({
                                ...disbursementForm,
                                amount: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="purpose">Purpose *</Label>
                        <select
                          id="purpose"
                          value={disbursementForm.purpose}
                          onChange={(e) =>
                            setDisbursementForm({
                              ...disbursementForm,
                              purpose: e.target.value,
                            })
                          }
                          className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select purpose</option>
                          <option value="Competition Registration">
                            Competition Registration
                          </option>
                          <option value="Travel & Lodging">Travel & Lodging</option>
                          <option value="Equipment & Supplies">
                            Equipment & Supplies
                          </option>
                          <option value="Team Apparel">Team Apparel</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Provide details about this expense..."
                          value={disbursementForm.description}
                          onChange={(e) =>
                            setDisbursementForm({
                              ...disbursementForm,
                              description: e.target.value,
                            })
                          }
                          className="mt-2"
                          rows={3}
                        />
                      </div>
                      {disbursementForm.amount &&
                        parseFloat(disbursementForm.amount) >= 500 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                              <p className="text-sm text-yellow-900">
                                This request requires guardian approval (Threshold:
                                $500+)
                              </p>
                            </div>
                          </div>
                        )}
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsRequestDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleDisbursementRequest}
                        disabled={
                          !disbursementForm.amount || !disbursementForm.purpose
                        }
                      >
                        Submit Request
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  View All Transactions
                </Button>
              </CardContent>
            </Card>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-warning" />
                    Pending Requests ({pendingRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(request.requestedAmount)}
                          </p>
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            Pending
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{request.purpose}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Requested {formatRelativeTime(request.requestedAt)}
                        </p>
                        <p className="text-xs text-yellow-700 mt-2">
                          Awaiting guardian approval
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedDisbursements.map((disbursement) => (
                    <div
                      key={disbursement.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <div className="w-2 h-2 rounded-full bg-success mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(disbursement.requestedAmount)} -{" "}
                          {disbursement.purpose}
                        </p>
                        <p className="text-xs text-gray-500">
                          Completed {formatRelativeTime(disbursement.completedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
