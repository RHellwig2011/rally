"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DollarSign,
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
  Heart,
  Trophy,
  GraduationCap,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatWholeDollars,
  InitialsAvatar,
  Kicker,
  PageTitle,
  SiteHeader,
  statStyles,
  TeamChip,
} from "@/components/app-chrome";
import { useCsrfToken } from "@/hooks/useCsrfToken";

// The campaign/disbursement/donation APIs return DOLLAR values;
// formatCurrency expects cents, so convert before formatting.
const toCents = (dollars: unknown) => Math.round(Number(dollars ?? 0) * 100);

// Night-card silhouette for the loading state — matches the real Card's
// gradient/hairline/radius so the skeleton doesn't flash a different shape.
const SKELETON_CARD =
  "rounded-card border border-white/10 bg-[linear-gradient(165deg,#1B2334,#121826)] p-6 shadow-card";

// The hero total is drawn twice: a solid numeral lifted by the stacked red
// text-shadow (BRIEF §2), and an offset outline-only copy behind it (BRIEF §4
// screen 05, "ghost" numeral). Both share the fluid Archivo sizing so they stay
// registered at any width.
const RAISED_SIZING =
  "font-display text-[clamp(52px,9vw,84px)] font-extrabold leading-none tracking-[-0.03em] tabular";
const RAISED_NUMERAL = `relative z-[2] ${RAISED_SIZING} text-foreground [text-shadow:0_2px_0_rgba(200,16,46,.5),0_6px_0_rgba(200,16,46,.2),0_18px_44px_rgba(200,16,46,.25)]`;
const RAISED_GHOST = `pointer-events-none absolute left-1 top-[-7px] z-[1] select-none whitespace-nowrap ${RAISED_SIZING} text-transparent [-webkit-text-stroke:1px_rgba(238,241,246,.14)]`;

const { cell: STAT_CELL, num: STAT_NUM, label: STAT_LABEL } = statStyles;

// Card section heads (BRIEF §2): uppercase 15px Archivo rather than the
// default CardTitle scale, which is sized for hero cards.
const SECTION_TITLE =
  "flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-[0.04em]";

// The status enum is stored verbatim; coaches should never read it raw.
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft — not accepting gifts yet",
  ACTIVE: "Live",
  PAUSED: "Paused — gifts are on hold",
  COMPLETED: "Wrapped up",
  ARCHIVED: "Archived",
};

const statusLabel = (status: string) => STATUS_LABELS[status] || status;

const PURPOSE_LABELS: Record<string, string> = {
  EQUIPMENT: "Equipment & Supplies",
  TRAVEL: "Travel & Lodging",
  UNIFORMS: "Team Apparel",
  FACILITIES: "Facilities",
  TOURNAMENT_FEES: "Competition Registration",
  OTHER: "Other",
};

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
  const { csrfToken } = useCsrfToken();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingDisbursement, setIsSubmittingDisbursement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isStatusHistoryDialogOpen, setIsStatusHistoryDialogOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<string | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState("");
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [disbursementNotice, setDisbursementNotice] = useState<string | null>(null);
  const [disbursementError, setDisbursementError] = useState<string | null>(null);
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

      // Fetch recent donations and disbursement requests alongside the
      // campaign. These are secondary — tolerate failures (e.g. a viewer
      // without disbursement access) and fall back to empty lists.
      const [donationsResult, disbursementsResult] = await Promise.all([
        fetch(`/api/campaigns/${params.campaignId}/recent-donations?limit=5`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`/api/campaigns/${params.campaignId}/disbursements`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      // The API returns { success: true, campaign: {...} }
      // No need to convert - API already converts BigInt to numbers
      const dashboardData: DashboardData = {
        campaign: result.campaign,
        bankingAccount: result.campaign.bankingAccount || null,
        recentDonations: donationsResult?.donations || [],
        disbursementRequests: disbursementsResult?.disbursements || [],
        teamMembers: [],  // Not rendered on this page yet
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

  const refreshDisbursements = async () => {
    try {
      const res = await fetch(`/api/campaigns/${params.campaignId}/disbursements`);
      const result = await res.json();
      if (res.ok && result.success) {
        setData((prev) =>
          prev ? { ...prev, disbursementRequests: result.disbursements || [] } : prev
        );
      }
    } catch (err) {
      console.error('Error refreshing disbursements:', err);
    }
  };

  const handleDisbursementRequest = async () => {
    try {
      setIsSubmittingDisbursement(true);
      setDisbursementError(null);
      setDisbursementNotice(null);
      const res = await fetch(`/api/campaigns/${params.campaignId}/disbursements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          amount: parseFloat(disbursementForm.amount), // API expects dollars
          purpose: disbursementForm.purpose,
          description: disbursementForm.description,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        const details = Array.isArray(result.details)
          ? `: ${result.details.map((d: any) => d.message).join(', ')}`
          : '';
        throw new Error((result.error || 'Failed to submit disbursement request') + details);
      }

      setDisbursementNotice(
        "Request sent. We'll email you when it's approved — usually a few days."
      );
      setIsRequestDialogOpen(false);
      setDisbursementForm({ amount: "", purpose: "", description: "" });
      refreshDisbursements();
    } catch (err) {
      console.error('Error submitting disbursement request:', err);
      setDisbursementError(
        err instanceof Error ? err.message : 'Failed to submit disbursement request'
      );
    } finally {
      setIsSubmittingDisbursement(false);
    }
  };

  // "Share Campaign" used to be a plain link to the public page. Coaches want
  // the URL in their thumbs, not another tab.
  const handleShareCampaign = async () => {
    if (typeof window === 'undefined' || !data) return;
    const url = `${window.location.origin}/raise/${data.campaign.slug}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${data.campaign.organizationName} ${data.campaign.teamName}`,
          url,
        });
        return;
      } catch (err) {
        // A cancelled share sheet is not a failure worth reporting.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareNotice('Link copied — paste it in your team text thread');
    } catch {
      setShareNotice("We couldn't copy the link — copy it from the address bar");
    }
    setTimeout(() => setShareNotice(null), 4000);
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
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
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
      alert(`Campaign status updated to ${statusLabel(selectedNewStatus)}.`);

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
      const body: Record<string, unknown> = {
        organizationName: settingsForm.organizationName,
        teamName: settingsForm.teamName,
        description: settingsForm.description,
        goalAmount: parseFloat(settingsForm.goalAmount), // API expects dollars
      };
      // The API schema rejects endDate: null — omit the key when blank
      if (settingsForm.endDate) {
        body.endDate = new Date(settingsForm.endDate).toISOString();
      }

      const res = await fetch(`/api/campaigns/${params.campaignId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(body),
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
      goalAmount: String(data.campaign.goalAmount ?? ''), // API already returns dollars
      endDate: data.campaign.endDate ? new Date(data.campaign.endDate).toISOString().split('T')[0] : '',
    });
    setIsSettingsDialogOpen(true);
  };

  // Helper functions for status
  // Status pills on the night shell: soft tinted fills with the matching
  // brief colour for the label (BRIEF §4 screen 11 "edge states").
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'border-white/10 bg-white/[0.06] text-muted-foreground';
      case 'ACTIVE': return 'border-secondary/40 bg-[rgba(34,196,139,.12)] text-success-dark';
      case 'PAUSED': return 'border-[rgba(232,163,61,.4)] bg-[rgba(232,163,61,.12)] text-[#E8A33D]';
      case 'COMPLETED': return 'border-white/10 bg-white/[0.08] text-foreground';
      case 'ARCHIVED': return 'border-white/10 bg-white/[0.06] text-muted-foreground';
      default: return 'border-white/10 bg-white/[0.06] text-foreground';
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
      <div className="min-h-screen">
        <SiteHeader />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <Skeleton className="h-9 w-96 mb-2" />
            <div className="flex flex-wrap gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-32" />
              ))}
            </div>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={SKELETON_CARD}>
                <div className="flex justify-between items-center mb-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>

          {/* Main Content Grid Skeleton */}
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Progress Card */}
              <div className={`${SKELETON_CARD} h-64`} />
              {/* Donations Card */}
              <div className={`${SKELETON_CARD} h-96`} />
            </div>
            <div className="space-y-6">
              {/* Banking Card */}
              <div className={`${SKELETON_CARD} h-80`} />
              {/* Activity Card */}
              <div className={`${SKELETON_CARD} h-64`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Failed to Load Campaign</h2>
          <p className="text-muted-foreground mb-4">{error || 'Unknown error occurred'}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  const percentage = calculatePercentage(
    toCents(data.campaign.currentAmount),
    toCents(data.campaign.goalAmount)
  );

  // Banking details are only returned to owners/guardians/admins — null otherwise
  const banking = data.bankingAccount;

  const pendingRequests = data.disbursementRequests.filter(dr => dr.status === 'PENDING');
  const completedDisbursements = data.disbursementRequests.filter(
    dr => dr.status === 'COMPLETED'
  );

  return (
    <div className="min-h-screen">
      {/* Header — BRIEF §3 "Site header (app screens)" */}
      <SiteHeader
        left={
          <TeamChip className="hidden sm:inline-flex">
            {data.campaign.organizationName} · {data.campaign.teamName}
          </TeamChip>
        }
      >
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/raise/${data.campaign.slug}`}>
            <Eye className="w-4 h-4 mr-2" />
            View Public Page
          </Link>
        </Button>
        <InitialsAvatar initials="AT" />
      </SiteHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Campaign Header — BRIEF §4 screen 05 hero */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <Kicker tone="team">
                Command center · {statusLabel(data.campaign.status)}
              </Kicker>
              <PageTitle className="mt-2">
                {data.campaign.organizationName} {data.campaign.teamName}
              </PageTitle>
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
                    <span className="ml-2">{statusLabel(data.campaign.status)}</span>
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
                          Change status from{' '}
                          <span className="font-semibold">{statusLabel(data.campaign.status)}</span> to{' '}
                          <span className="font-semibold">{statusLabel(selectedNewStatus)}</span>
                        </>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  {selectedNewStatus && (
                    <div className="space-y-4 py-4">
                      <div className="bg-white/[0.04] border border-white/10 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          {getAvailableStatusTransitions(data.campaign.status).find(
                            t => t.status === selectedNewStatus
                          )?.icon}
                          <div>
                            <p className="font-semibold text-foreground">
                              {getAvailableStatusTransitions(data.campaign.status).find(
                                t => t.status === selectedNewStatus
                              )?.label}
                            </p>
                            <p className="text-sm text-foreground mt-1">
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
                        <p className="text-xs text-muted-foreground mt-1">
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
                        <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">No status changes recorded yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
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
                                <p className="font-semibold text-foreground">
                                  {change.from} → {change.to}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(change.timestamp)}
                                </span>
                              </div>
                              {change.reason && (
                                <p className="text-sm text-muted-foreground italic mb-2">
                                  "{change.reason}"
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
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

          {/* Hero — big raised total with the ghost/outline numeral behind it,
              days-left pill, goal bar and the pace note (BRIEF §4 screen 05). */}
          <div className="mb-6 grid gap-6 border-b border-border pb-7 lg:grid-cols-[1.5fr_1fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                <span className="relative inline-block leading-none">
                  {/* The campaign API returns DOLLARS; the hero prints them
                      whole, so no cents-conversion is involved here. */}
                  <span className={RAISED_NUMERAL}>
                    {formatWholeDollars(Number(data.campaign.currentAmount))}
                  </span>
                  <span aria-hidden="true" className={RAISED_GHOST}>
                    {formatWholeDollars(Number(data.campaign.currentAmount))}
                  </span>
                </span>
                <span className="text-[15px] text-muted-foreground">
                  raised of{" "}
                  <b className="tabular font-semibold text-foreground">
                    {formatCurrency(toCents(data.campaign.goalAmount))}
                  </b>{" "}
                  goal
                </span>
                {data.stats.daysLeft > 0 && (
                  <span className="inline-flex items-center gap-[7px] rounded-full bg-primary px-3.5 py-[7px] text-xs font-semibold text-primary-foreground shadow-glow-team">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="tabular">{data.stats.daysLeft}</span>{" "}
                    {data.stats.daysLeft === 1 ? "day" : "days"} left
                  </span>
                )}
              </div>

              {/* BRIEF §3 progress bar, hero variant: 12px track, green fill + glow */}
              <div
                role="progressbar"
                aria-valuenow={Math.min(percentage, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${percentage} percent of goal raised`}
                className="mt-4 h-3 overflow-hidden rounded-full border border-border bg-[#161B25]"
              >
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0F7A56,#22C48B)] shadow-[0_0_18px_rgba(34,196,139,.55)] transition-[width] duration-1000 ease-stadium"
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              <p className="mt-4 max-w-[640px] text-[clamp(15px,2.4vw,19px)] font-medium leading-[1.55] text-foreground">
                <b className="tabular font-semibold text-secondary [text-shadow:0_0_18px_rgba(34,196,139,.4)]">
                  {percentage}%
                </b>{" "}
                of goal from{" "}
                <b className="tabular font-semibold text-foreground">
                  {data.stats.donorCount}
                </b>{" "}
                {data.stats.donorCount === 1 ? "supporter" : "supporters"}
                {data.stats.avgDonation > 0 && (
                  <>
                    , averaging{" "}
                    <b className="tabular font-semibold text-foreground">
                      {formatCurrency(toCents(data.stats.avgDonation))}
                    </b>{" "}
                    a gift
                  </>
                )}
                .
              </p>
            </div>

            {/* Goal-completion panel — §3 "Stat blocks" treatment */}
            <div className="flex flex-col gap-3 rounded-card border border-border bg-[linear-gradient(160deg,#181E2A,#12161F)] p-5 shadow-[0_24px_50px_rgba(0,0,0,.35)]">
              <Kicker className="tracking-[0.14em]">Goal progress</Kicker>
              <div className="flex items-baseline gap-2">
                <b className="font-display text-[44px] font-black leading-none tracking-[-0.02em] tabular text-secondary [text-shadow:0_0_26px_rgba(34,196,139,.45)]">
                  {percentage}%
                </b>
                <span className="text-sm text-muted-foreground">of goal reached</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full border border-border bg-[#161B25]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0F7A56,#22C48B)] shadow-[0_0_12px_rgba(34,196,139,.5)] transition-[width] duration-1000 ease-stadium"
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <span className="text-[13px] font-medium text-muted-foreground">
                <b className="tabular font-semibold text-foreground">
                  {formatCurrency(
                    Math.max(
                      toCents(data.campaign.goalAmount) -
                        toCents(data.campaign.currentAmount),
                      0
                    )
                  )}
                </b>{" "}
                still to raise
              </span>
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
                  Congratulations! You've reached your fundraising goal of {formatCurrency(toCents(data.campaign.goalAmount))}.
                  You can continue fundraising or mark the campaign as complete.
                </AlertDescription>
              </Alert>
            )}

            {/* Low Balance Warning for Pending Disbursements */}
            {banking && banking.pendingDisbursement > banking.availableBalance && (
              <Alert variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Insufficient Balance for Pending Disbursements</AlertTitle>
                <AlertDescription>
                  You have {formatCurrency(toCents(banking.pendingDisbursement))} in pending disbursement requests,
                  but only {formatCurrency(toCents(banking.availableBalance))} available.
                  Some requests may need to wait for more donations.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Three things a volunteer coach actually does next; everything
              else is real but secondary, so it sits under "More". */}
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" onClick={handleShareCampaign}>
              <Share2 className="w-4 h-4 mr-2" />
              Share the team page
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${params.campaignId}/roster`}>
                <Users className="w-4 h-4 mr-2" />
                Add players
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${params.campaignId}/outreach`}>
                <Send className="w-4 h-4 mr-2" />
                Text / email families
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMoreActions(!showMoreActions)}
              aria-expanded={showMoreActions}
            >
              More
              <ChevronDown
                className={`w-4 h-4 ml-1 transition-transform ${showMoreActions ? 'rotate-180' : ''}`}
              />
            </Button>
          </div>

          {shareNotice && (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {shareNotice}
            </p>
          )}

          {showMoreActions && (
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/raise/${data.campaign.slug}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  Open public page
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
                  Message ideas
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/${params.campaignId}/cheer-wall`}>
                  <Heart className="w-4 h-4 mr-2" />
                  Cheer Wall
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/${params.campaignId}/leaderboard`}>
                  <Trophy className="w-4 h-4 mr-2" />
                  Leaderboard
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/${params.campaignId}/alumni`}>
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Alumni
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/campaigns/${params.campaignId}/export?type=donations`} download>
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Total Raised
              </CardTitle>
              <DollarSign className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-success-dark [text-shadow:0_0_18px_rgba(34,196,139,.35)]">
                {formatCurrency(toCents(banking ? banking.totalRaised : data.campaign.totalRaised))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Given to this campaign
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Donors
              </CardTitle>
              <Users className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-foreground">
                {data.stats.donorCount}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {data.stats.donorCount === 1 ? 'Person has given' : 'People have given'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Available Balance
              </CardTitle>
              <Wallet className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-foreground">
                {banking ? formatCurrency(toCents(banking.availableBalance)) : "—"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Ready to withdraw</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Disbursed
              </CardTitle>
              <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold tabular text-foreground">
                {banking ? formatCurrency(toCents(banking.disbursedTotal)) : "—"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Total paid out</p>
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
                <CardTitle className={SECTION_TITLE}>
                  <BarChart3 className="w-5 h-5" />
                  Fundraising Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Goal Progress
                      </p>
                      <p className="mt-1 font-display text-2xl font-extrabold tabular text-foreground">
                        {formatCurrency(toCents(data.campaign.currentAmount))}{" "}
                        <span className="text-base font-semibold text-muted-foreground">
                          of {formatCurrency(toCents(data.campaign.goalAmount))}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-3xl font-extrabold tabular text-secondary [text-shadow:0_0_20px_rgba(34,196,139,.4)]">
                        {percentage}%
                      </p>
                      <p className="text-sm text-muted-foreground">Complete</p>
                    </div>
                  </div>
                  {/* BRIEF §3 progress bar */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-secondary shadow-glow-accent transition-all duration-500 ease-stadium"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5 pt-2 sm:grid-cols-4">
                    <div className={STAT_CELL}>
                      <p className={STAT_NUM}>{data.stats.donorCount}</p>
                      <p className={STAT_LABEL}>Donors</p>
                    </div>
                    <div className={STAT_CELL}>
                      <p className={STAT_NUM}>
                        {formatCurrency(toCents(data.stats.avgDonation))}
                      </p>
                      <p className={STAT_LABEL}>Avg Donation</p>
                    </div>
                    <div className={STAT_CELL}>
                      <p className={`${STAT_NUM} text-success-dark`}>
                        +{data.stats.newDonorsToday}
                      </p>
                      <p className={STAT_LABEL}>Today</p>
                    </div>
                    <div className={STAT_CELL}>
                      <p className={STAT_NUM}>{data.stats.daysLeft}</p>
                      <p className={STAT_LABEL}>Days Left</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Donations */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={SECTION_TITLE}>
                    <Users className="w-5 h-5" />
                    Recent Donations
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {data.recentDonations.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No donations yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Share your campaign link to start receiving donations
                    </p>
                    <Button variant="outline" onClick={handleShareCampaign}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share your campaign link
                    </Button>
                    {shareNotice && (
                      <p role="status" className="mt-2 text-sm text-muted-foreground">
                        {shareNotice}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.recentDonations.map((donation) => (
                      <div
                        key={donation.id}
                        className="flex items-start justify-between pb-4 border-b last:border-0 last:pb-0"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full border border-white/10 bg-[rgba(200,16,46,.14)] flex items-center justify-center flex-shrink-0">
                            <DollarSign className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {donation.donorName}
                            </p>
                            {donation.message && (
                              <p className="text-sm text-muted-foreground mt-1 italic">
                                "{donation.message}"
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatRelativeTime(donation.timestamp)}
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold tabular text-success-dark">
                          {formatCurrency(toCents(donation.amount))}
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
                <CardTitle className={SECTION_TITLE}>
                  <Wallet className="w-5 h-5" />
                  Banking & Funds
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_26px_rgba(0,0,0,.35)]">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Available Balance
                  </p>
                  <p className="font-display text-3xl font-extrabold tabular text-foreground">
                    {banking ? formatCurrency(toCents(banking.availableBalance)) : "—"}
                  </p>
                </div>

                {disbursementNotice && (
                  <Alert variant="success">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{disbursementNotice}</AlertDescription>
                  </Alert>
                )}

                <Dialog
                  open={isRequestDialogOpen}
                  onOpenChange={setIsRequestDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button className="w-full" size="lg">
                      <Wallet className="w-4 h-4 mr-2" />
                      Send money to the team account
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Use campaign funds</DialogTitle>
                      <DialogDescription>
                        Available Balance:{" "}
                        {banking ? formatCurrency(toCents(banking.availableBalance)) : "—"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="amount">Amount to Request *</Label>
                        <div className="flex items-center mt-2">
                          <span className="text-muted-foreground mr-2">$</span>
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
                          className="mt-2 flex h-11 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-foreground [color-scheme:dark] focus-visible:border-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(14,124,90,.35)]"
                        >
                          <option value="">Select purpose</option>
                          <option value="TOURNAMENT_FEES">
                            Competition Registration
                          </option>
                          <option value="TRAVEL">Travel & Lodging</option>
                          <option value="EQUIPMENT">
                            Equipment & Supplies
                          </option>
                          <option value="UNIFORMS">Team Apparel</option>
                          <option value="FACILITIES">Facilities</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="description">Description * (min 10 characters)</Label>
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
                          <div className="bg-[rgba(232,163,61,.08)] border border-[rgba(232,163,61,.4)] rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-[#E8A33D] mt-0.5" />
                              <p className="text-sm text-[#E8A33D]">
                                Gifts over $500 need a parent/guardian to approve.
                                We&apos;ll email them.
                              </p>
                            </div>
                          </div>
                        )}
                    </div>
                    {disbursementError && (
                      <p
                        role="alert"
                        className="rounded-lg border border-warning bg-warning-light px-3 py-2 text-sm text-warning-dark"
                      >
                        {disbursementError}
                      </p>
                    )}
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
                          isSubmittingDisbursement ||
                          !disbursementForm.amount ||
                          !disbursementForm.purpose ||
                          disbursementForm.description.trim().length < 10
                        }
                      >
                        {isSubmittingDisbursement ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Request'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>


              </CardContent>
            </Card>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className={SECTION_TITLE}>
                    <Clock className="w-4 h-4 text-warning" />
                    Pending Requests ({pendingRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="bg-[rgba(232,163,61,.08)] border border-[rgba(232,163,61,.4)] rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-display text-lg font-extrabold tabular text-foreground">
                            {formatCurrency(toCents(request.amount))}
                          </p>
                          <span className="rounded-full border border-[rgba(232,163,61,.4)] bg-[rgba(232,163,61,.14)] px-2 py-1 text-xs font-semibold text-[#E8A33D]">
                            Pending
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          {PURPOSE_LABELS[request.purpose] || request.purpose}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Requested {formatRelativeTime(request.createdAt)}
                        </p>
                        <p className="text-xs text-[#E8A33D] mt-2">
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
                <CardTitle className={SECTION_TITLE}>
                  <Check className="w-4 h-4 text-success" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedDisbursements.length === 0 ? (
                  <div className="text-center py-8">
                    <Check className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                    <p className="text-xs text-muted-foreground mt-1">
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
                          <p className="font-medium tabular text-foreground">
                            {formatCurrency(toCents(disbursement.amount))} -{" "}
                            {PURPOSE_LABELS[disbursement.purpose] || disbursement.purpose}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Completed {formatRelativeTime(disbursement.approvedAt || disbursement.createdAt)}
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
