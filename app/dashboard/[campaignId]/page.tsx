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
  Sparkles,
  ChevronDown,
  Pause,
  Play,
  CheckCircle,
  Archive,
  FileText,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatRelativeTime, calculatePercentage } from "@/lib/utils";
import { exportStatusHistoryToCSV } from "@/lib/utils/export";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

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
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isStatusHistoryDialogOpen, setIsStatusHistoryDialogOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<string | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState("");
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [disbursementForm, setDisbursementForm] = useState({
    amount: "",
    purpose: "",
    description: "",
  });
  const [settingsForm, setSettingsForm] = useState({
    organizationName: "",
    teamName: "",
    description: "",
    goalAmount: "",
    endDate: "",
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

      // The API returns { success: true, campaign: {...} }
      // No need to convert - API already converts BigInt to numbers
      const dashboardData: DashboardData = {
        campaign: result.campaign,
        bankingAccount: result.campaign.bankingAccount || null,
        recentDonations: [],  // Will be fetched separately or add to API
        disbursementRequests: [],  // Will be fetched separately or add to API
        teamMembers: [],  // Will be fetched separately or add to API
        stats: {
          donorCount: result.campaign.statistics?.uniqueDonorCount || 0,
          avgDonation: result.campaign.statistics?.averageDonation || 0,
          newDonorsToday: 0,  // TODO: Add to API
          daysLeft: result.campaign.daysRemaining || 0,
        },
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

  const openStatusChangeDialog = (newStatus: string) => {
    setSelectedNewStatus(newStatus);
    setStatusChangeReason("");
    setIsStatusDialogOpen(true);
  };

  const handleStatusChange = async () => {
    if (!data || !selectedNewStatus) return;

    try {
      setIsChangingStatus(true);
      const res = await fetch(`/api/campaigns/${params.campaignId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedNewStatus,
          reason: statusChangeReason || undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to update status');
      }

      // Update local state
      setData({
        ...data,
        campaign: {
          ...data.campaign,
          status: selectedNewStatus,
        },
      });

      setIsStatusDialogOpen(false);
      setSelectedNewStatus(null);
      setStatusChangeReason("");
      alert(`Campaign status updated to ${selectedNewStatus}!`);

      // Refresh status history
      fetchStatusHistory();
    } catch (err) {
      console.error('Error updating status:', err);
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsChangingStatus(false);
    }
  };

  const fetchStatusHistory = async () => {
    try {
      const res = await fetch(`/api/campaigns/${params.campaignId}/status`);
      const result = await res.json();

      if (res.ok && result.success) {
        setStatusHistory(result.history || []);
      }
    } catch (err) {
      console.error('Error fetching status history:', err);
    }
  };

  const handleSettingsUpdate = async () => {
    if (!data) return;

    try {
      const res = await fetch(`/api/campaigns/${params.campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: settingsForm.organizationName,
          teamName: settingsForm.teamName,
          description: settingsForm.description,
          goalAmount: parseFloat(settingsForm.goalAmount) * 100, // Convert to cents
          endDate: settingsForm.endDate ? new Date(settingsForm.endDate).toISOString() : null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to update campaign');
      }

      alert('Campaign settings updated successfully!');
      setIsSettingsDialogOpen(false);
      fetchDashboardData(); // Refresh data
    } catch (err) {
      console.error('Error updating settings:', err);
      alert(err instanceof Error ? err.message : 'Failed to update settings');
    }
  };

  const openSettingsDialog = () => {
    if (!data) return;
    // Pre-fill form with current values
    setSettingsForm({
      organizationName: data.campaign.organizationName || '',
      teamName: data.campaign.teamName || '',
      description: data.campaign.description || '',
      goalAmount: (Number(data.campaign.goalAmount) / 100).toString(),
      endDate: data.campaign.endDate ? new Date(data.campaign.endDate).toISOString().split('T')[0] : '',
    });
    setIsSettingsDialogOpen(true);
  };

  // Helper functions for status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800';
      case 'ARCHIVED': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT': return <FileText className="w-4 h-4" />;
      case 'ACTIVE': return <Play className="w-4 h-4" />;
      case 'PAUSED': return <Pause className="w-4 h-4" />;
      case 'COMPLETED': return <CheckCircle className="w-4 h-4" />;
      case 'ARCHIVED': return <Archive className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getAvailableStatusTransitions = (currentStatus: string) => {
    const transitions: Record<string, Array<{status: string, label: string, icon: any, description: string}>> = {
      DRAFT: [
        {
          status: 'ACTIVE',
          label: 'Activate Campaign',
          icon: <Play className="w-4 h-4" />,
          description: 'Make this campaign live and start accepting donations'
        },
        {
          status: 'ARCHIVED',
          label: 'Archive',
          icon: <Archive className="w-4 h-4" />,
          description: 'Archive this draft campaign'
        },
      ],
      ACTIVE: [
        {
          status: 'PAUSED',
          label: 'Pause Campaign',
          icon: <Pause className="w-4 h-4" />,
          description: 'Temporarily pause donation collection'
        },
        {
          status: 'COMPLETED',
          label: 'Mark Complete',
          icon: <CheckCircle className="w-4 h-4" />,
          description: 'Mark this campaign as successfully completed'
        },
      ],
      PAUSED: [
        {
          status: 'ACTIVE',
          label: 'Resume Campaign',
          icon: <Play className="w-4 h-4" />,
          description: 'Resume accepting donations'
        },
        {
          status: 'COMPLETED',
          label: 'Mark Complete',
          icon: <CheckCircle className="w-4 h-4" />,
          description: 'Mark this campaign as successfully completed'
        },
        {
          status: 'ARCHIVED',
          label: 'Archive',
          icon: <Archive className="w-4 h-4" />,
          description: 'Archive this paused campaign'
        },
      ],
      COMPLETED: [
        {
          status: 'ARCHIVED',
          label: 'Archive',
          icon: <Archive className="w-4 h-4" />,
          description: 'Archive this completed campaign'
        },
      ],
      ARCHIVED: [],
    };
    return transitions[currentStatus] || [];
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
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-9 w-96 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="flex flex-wrap gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-5 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Main Content Grid Skeleton */}
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Progress Card */}
              <div className="bg-white border rounded-lg p-6 h-64 animate-pulse" />
              {/* Donations Card */}
              <div className="bg-white border rounded-lg p-6 h-96 animate-pulse" />
            </div>
            <div className="space-y-6">
              {/* Banking Card */}
              <div className="bg-white border rounded-lg p-6 h-80 animate-pulse" />
              {/* Activity Card */}
              <div className="bg-white border rounded-lg p-6 h-64 animate-pulse" />
            </div>
          </div>
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
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {data.campaign.organizationName} {data.campaign.teamName}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Status Badge with Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className={`${getStatusColor(data.campaign.status)} border-0 font-semibold`}
                    disabled={isChangingStatus || data.campaign.status === 'ARCHIVED'}
                  >
                    {getStatusIcon(data.campaign.status)}
                    <span className="ml-2">{data.campaign.status}</span>
                    {data.campaign.status !== 'ARCHIVED' && (
                      <ChevronDown className="ml-1 w-4 h-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                {data.campaign.status !== 'ARCHIVED' && (
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {getAvailableStatusTransitions(data.campaign.status).map((transition) => (
                      <DropdownMenuItem
                        key={transition.status}
                        onClick={() => openStatusChangeDialog(transition.status)}
                        className="cursor-pointer"
                      >
                        {transition.icon}
                        <span className="ml-2">{transition.label}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        fetchStatusHistory();
                        setIsStatusHistoryDialogOpen(true);
                      }}
                      className="cursor-pointer"
                    >
                      <Clock className="w-4 h-4" />
                      <span className="ml-2">View History</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                )}
              </DropdownMenu>

              {/* Settings Dialog */}
              <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" onClick={openSettingsDialog}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Campaign Settings</DialogTitle>
                    <DialogDescription>
                      Update your campaign details and configuration
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="organizationName">Organization Name *</Label>
                        <Input
                          id="organizationName"
                          value={settingsForm.organizationName}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, organizationName: e.target.value })
                          }
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="teamName">Team Name *</Label>
                        <Input
                          id="teamName"
                          value={settingsForm.teamName}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, teamName: e.target.value })
                          }
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={settingsForm.description}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, description: e.target.value })
                        }
                        className="mt-2"
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="goalAmount">Goal Amount ($) *</Label>
                        <Input
                          id="goalAmount"
                          type="number"
                          value={settingsForm.goalAmount}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, goalAmount: e.target.value })
                          }
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={settingsForm.endDate}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, endDate: e.target.value })
                          }
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSettingsUpdate}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Status Change Confirmation Dialog */}
              <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Change Campaign Status</DialogTitle>
                    <DialogDescription>
                      {selectedNewStatus && (
                        <>
                          Change status from <span className="font-semibold">{data.campaign.status}</span> to{' '}
                          <span className="font-semibold">{selectedNewStatus}</span>
                        </>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  {selectedNewStatus && (
                    <div className="space-y-4 py-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          {getAvailableStatusTransitions(data.campaign.status).find(
                            t => t.status === selectedNewStatus
                          )?.icon}
                          <div>
                            <p className="font-semibold text-blue-900">
                              {getAvailableStatusTransitions(data.campaign.status).find(
                                t => t.status === selectedNewStatus
                              )?.label}
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                              {getAvailableStatusTransitions(data.campaign.status).find(
                                t => t.status === selectedNewStatus
                              )?.description}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="statusReason">Reason (Optional)</Label>
                        <Textarea
                          id="statusReason"
                          placeholder="Provide a reason for this status change..."
                          value={statusChangeReason}
                          onChange={(e) => setStatusChangeReason(e.target.value)}
                          className="mt-2"
                          rows={3}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This will be recorded in the campaign history
                        </p>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsStatusDialogOpen(false);
                        setSelectedNewStatus(null);
                        setStatusChangeReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleStatusChange}
                      disabled={isChangingStatus}
                    >
                      {isChangingStatus ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Confirm Change'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Status History Dialog */}
              <Dialog open={isStatusHistoryDialogOpen} onOpenChange={setIsStatusHistoryDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Campaign Status History</DialogTitle>
                    <DialogDescription>
                      Track all status changes for this campaign
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    {statusHistory.length === 0 ? (
                      <div className="text-center py-8">
                        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No status changes recorded yet</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Status change history will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {statusHistory.map((change, index) => (
                          <div
                            key={index}
                            className="flex gap-4 pb-4 border-b last:border-0 last:pb-0"
                          >
                            <div className="flex-shrink-0">
                              <div className={`w-10 h-10 rounded-full ${getStatusColor(change.to)} flex items-center justify-center`}>
                                {getStatusIcon(change.to)}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-gray-900">
                                  {change.from} → {change.to}
                                </p>
                                <span className="text-xs text-gray-500">
                                  {formatRelativeTime(change.timestamp)}
                                </span>
                              </div>
                              {change.reason && (
                                <p className="text-sm text-gray-600 italic mb-2">
                                  "{change.reason}"
                                </p>
                              )}
                              <p className="text-xs text-gray-500">
                                Changed by {change.changedBy?.name || change.changedBy?.email}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    {statusHistory.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const campaignName = `${data.campaign.organizationName} ${data.campaign.teamName}`;
                          exportStatusHistoryToCSV(statusHistory, campaignName);
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export to CSV
                      </Button>
                    )}
                    <Button onClick={() => setIsStatusHistoryDialogOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Status-based Alerts */}
          <div className="space-y-3">
            {/* Campaign Paused Alert */}
            {data.campaign.status === 'PAUSED' && (
              <Alert variant="warning">
                <Pause className="h-4 w-4" />
                <AlertTitle>Campaign Paused</AlertTitle>
                <AlertDescription>
                  This campaign is currently paused. Donations are not being accepted. Resume the campaign to continue fundraising.
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-4"
                    onClick={() => openStatusChangeDialog('ACTIVE')}
                  >
                    Resume Campaign
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Campaign Completed Alert */}
            {data.campaign.status === 'COMPLETED' && (
              <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Campaign Successfully Completed</AlertTitle>
                <AlertDescription>
                  Congratulations! This campaign has been marked as complete. You can still request final disbursements or archive the campaign.
                </AlertDescription>
              </Alert>
            )}

            {/* Campaign Draft Alert */}
            {data.campaign.status === 'DRAFT' && (
              <Alert variant="warning">
                <FileText className="h-4 w-4" />
                <AlertTitle>Campaign in Draft Mode</AlertTitle>
                <AlertDescription>
                  This campaign is not yet live. Activate it to start accepting donations.
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-4"
                    onClick={() => openStatusChangeDialog('ACTIVE')}
                  >
                    Activate Campaign
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* End Date Approaching Warning */}
            {data.campaign.status === 'ACTIVE' && data.campaign.endDate && (() => {
              const endDate = new Date(data.campaign.endDate);
              const now = new Date();
              const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

              if (daysLeft <= 7 && daysLeft > 0) {
                return (
                  <Alert variant="warning">
                    <Clock className="h-4 w-4" />
                    <AlertTitle>Campaign Ending Soon</AlertTitle>
                    <AlertDescription>
                      Your campaign ends in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}. Make a final push to reach your goal!
                    </AlertDescription>
                  </Alert>
                );
              } else if (daysLeft <= 0) {
                return (
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Campaign End Date Passed</AlertTitle>
                    <AlertDescription>
                      The end date for this campaign has passed. Consider marking it as complete.
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-4"
                        onClick={() => openStatusChangeDialog('COMPLETED')}
                      >
                        Mark Complete
                      </Button>
                    </AlertDescription>
                  </Alert>
                );
              }
              return null;
            })()}

            {/* Goal Reached Alert */}
            {data.campaign.status === 'ACTIVE' &&
             data.campaign.currentAmount >= data.campaign.goalAmount && (
              <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Goal Reached! 🎉</AlertTitle>
                <AlertDescription>
                  Congratulations! You've reached your fundraising goal of {formatCurrency(data.campaign.goalAmount)}.
                  You can continue fundraising or mark the campaign as complete.
                </AlertDescription>
              </Alert>
            )}

            {/* Low Balance Warning for Pending Disbursements */}
            {data.bankingAccount.pendingDisbursement > data.bankingAccount.availableBalance && (
              <Alert variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Insufficient Balance for Pending Disbursements</AlertTitle>
                <AlertDescription>
                  You have {formatCurrency(data.bankingAccount.pendingDisbursement)} in pending disbursement requests,
                  but only {formatCurrency(data.bankingAccount.availableBalance)} available.
                  Some requests may need to wait for more donations.
                </AlertDescription>
              </Alert>
            )}
          </div>

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
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${params.campaignId}/posters`}>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Posters
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${params.campaignId}/analytics`}>
                <BarChart3 className="w-4 h-4 mr-2" />
                View Analytics
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${params.campaignId}/messages`}>
                <Sparkles className="w-4 h-4 mr-2" />
                AI Messages
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${params.campaignId}/outreach`}>
                <Send className="w-4 h-4 mr-2" />
                Mass Outreach
              </Link>
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
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
                {data.recentDonations.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No donations yet
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Share your campaign link to start receiving donations
                    </p>
                    <Button asChild variant="outline">
                      <Link href={`/raise/${data.campaign.slug}`}>
                        <Share2 className="w-4 h-4 mr-2" />
                        View Public Page
                      </Link>
                    </Button>
                  </div>
                ) : (
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
                )}
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
                {completedDisbursements.length === 0 ? (
                  <div className="text-center py-8">
                    <Check className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">No recent activity</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Completed disbursements will appear here
                    </p>
                  </div>
                ) : (
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
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
