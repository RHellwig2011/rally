"use client";

import { useState, useEffect } from "react";
import {
  FileCheck,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Download,
  Calendar,
  User,
  DollarSign,
  Loader2,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { useCsrfToken } from "@/hooks/useCsrfToken";

interface Disbursement {
  id: string;
  requestedAmount: number; // integer cents
  purpose: string;
  description?: string | null;
  receiptsUrls?: string[];
  requestedAt: string;
  status: string;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  disbursementDate?: string | null;
  requestedByUser: {
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedByUser?: {
    firstName: string;
    lastName: string;
  } | null;
  bankingAccount: {
    availableBalance: number; // integer cents
    campaign: {
      id: string;
      teamName: string;
      organizationName: string;
    };
  };
}

interface StatusConfigEntry {
  label: string;
  icon: typeof Clock;
  color: string;
  bgColor: string;
  borderColor: string;
}

const statusConfig: Record<string, StatusConfigEntry> = {
  PENDING: {
    label: "Pending Review",
    icon: Clock,
    color: "text-warning",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
  },
  PROCESSING: {
    label: "Processing",
    icon: Loader2,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
  },
  APPROVED: {
    label: "Approved",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100",
    borderColor: "border-green-300",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle,
    color: "text-success",
    bgColor: "bg-success-100",
    borderColor: "border-green-300",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: XCircle,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
  },
};

// Fallback so unknown/new statuses never crash the page
function getStatusConfig(status: string): StatusConfigEntry {
  return (
    statusConfig[status] ?? {
      label: status,
      icon: AlertCircle,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
      borderColor: "border-gray-300",
    }
  );
}

const MIN_REJECTION_REASON_LENGTH = 10;

export default function AdminDisbursementsPage() {
  const { csrfToken } = useCsrfToken();
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDisbursements();
  }, [statusFilter]);

  async function fetchDisbursements() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/admin/disbursements?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch disbursements");
      }

      const data = await response.json();
      if (data.success) {
        setDisbursements(data.requests || []);
      } else {
        throw new Error(data.error || "Failed to load disbursements");
      }
    } catch (err) {
      console.error("Error fetching disbursements:", err);
      setError(err instanceof Error ? err.message : "Failed to load disbursements");
    } finally {
      setLoading(false);
    }
  }

  const filteredDisbursements = disbursements.filter((disbursement) => {
    const campaignName = disbursement.bankingAccount.campaign.teamName || "";
    const requestedByName = `${disbursement.requestedByUser.firstName} ${disbursement.requestedByUser.lastName}`;

    const matchesSearch =
      campaignName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      disbursement.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      requestedByName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const stats = {
    pending: disbursements.filter((d) => d.status === "PENDING").length,
    approved: disbursements.filter((d) => d.status === "APPROVED").length,
    rejected: disbursements.filter((d) => d.status === "REJECTED").length,
    completed: disbursements.filter((d) => d.status === "COMPLETED").length,
    totalPendingAmount: disbursements
      .filter((d) => d.status === "PENDING")
      .reduce((sum, d) => sum + Number(d.requestedAmount), 0),
  };

  async function handleApprove() {
    if (!selectedDisbursement) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/disbursements/${selectedDisbursement.id}/approve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to approve disbursement");
      }

      // Refresh the list
      await fetchDisbursements();

      setIsApproveDialogOpen(false);
      setSelectedDisbursement(null);
    } catch (err) {
      console.error("Error approving disbursement:", err);
      alert(err instanceof Error ? err.message : "Failed to approve disbursement");
    } finally {
      setActionLoading(false);
    }
  }

  // Approval only records the decision. This is the step that actually moves
  // money, via the Stripe Connect payout route.
  async function handlePayout() {
    if (!selectedDisbursement) return;

    try {
      setActionLoading(true);
      const response = await fetch("/api/stripe-connect/payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ disbursementRequestId: selectedDisbursement.id }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send payout");
      }

      // Refresh the list
      await fetchDisbursements();

      setIsPayoutDialogOpen(false);
      setSelectedDisbursement(null);
    } catch (err) {
      console.error("Error sending payout:", err);
      alert(err instanceof Error ? err.message : "Failed to send payout");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (
      !selectedDisbursement ||
      rejectionReason.trim().length < MIN_REJECTION_REASON_LENGTH
    )
      return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/disbursements/${selectedDisbursement.id}/reject`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to reject disbursement");
      }

      // Refresh the list
      await fetchDisbursements();

      setIsRejectDialogOpen(false);
      setSelectedDisbursement(null);
      setRejectionReason("");
    } catch (err) {
      console.error("Error rejecting disbursement:", err);
      alert(err instanceof Error ? err.message : "Failed to reject disbursement");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading && disbursements.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading disbursements...</p>
        </div>
      </div>
    );
  }

  if (error && disbursements.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-foreground font-semibold mb-2">Failed to load disbursements</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchDisbursements()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Disbursement Approvals
        </h1>
        <p className="text-muted-foreground">
          Review and approve fund disbursement requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">
              {stats.approved}
            </div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{stats.rejected}</div>
            <div className="text-sm text-muted-foreground">Rejected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">
              {stats.completed}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-lg font-bold text-foreground">
              {formatCurrency(stats.totalPendingAmount)}
            </div>
            <div className="text-sm text-muted-foreground">Pending Amount</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns, purposes, or requesters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disbursements List */}
      <div className="space-y-4">
        {filteredDisbursements.map((disbursement) => {
          const config = getStatusConfig(disbursement.status);
          const StatusIcon = config.icon;

          return (
            <Card
              key={disbursement.id}
              className={`border-l-4 ${config.borderColor} hover:shadow-md transition-shadow`}
            >
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${config.bgColor} ${config.color} font-medium`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                        <h3 className="text-lg font-semibold text-foreground">
                          {formatCurrency(Number(disbursement.requestedAmount))}
                        </h3>
                      </div>
                      <h4 className="text-base font-semibold text-foreground mb-1">
                        {disbursement.bankingAccount.campaign.teamName}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {disbursement.bankingAccount.campaign.organizationName}
                      </p>
                    </div>
                  </div>

                  {/* Purpose & Description */}
                  <div className="bg-muted rounded-lg p-4">
                    <h5 className="font-semibold text-foreground mb-1">
                      Purpose: {disbursement.purpose}
                    </h5>
                    <p className="text-sm text-muted-foreground">
                      {disbursement.description}
                    </p>
                  </div>

                  {/* Details Grid */}
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <User className="w-4 h-4" />
                        <span className="font-medium">Requested By:</span>
                      </div>
                      <p className="text-foreground">
                        {disbursement.requestedByUser.firstName} {disbursement.requestedByUser.lastName}
                      </p>
                      <p className="text-muted-foreground">
                        {disbursement.requestedByUser.email}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">Requested:</span>
                      </div>
                      <p className="text-foreground">
                        {formatRelativeTime(new Date(disbursement.requestedAt))}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-medium">Available Balance:</span>
                      </div>
                      <p className="text-foreground">
                        {formatCurrency(Number(disbursement.bankingAccount.availableBalance))}
                      </p>
                    </div>
                    {disbursement.receiptsUrls && disbursement.receiptsUrls.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <FileCheck className="w-4 h-4" />
                          <span className="font-medium">Receipts:</span>
                        </div>
                        <div className="space-y-1">
                          {disbursement.receiptsUrls.map((_, idx) => (
                            <Button
                              key={idx}
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-primary"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              View Receipt {idx + 1}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rejection Reason (if rejected) */}
                  {disbursement.status === "REJECTED" && disbursement.rejectionReason && (
                    <div className="bg-warning-light border border-warning rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                        <div>
                          <p className="font-semibold text-warning-dark text-sm mb-1">
                            Rejection Reason:
                          </p>
                          <p className="text-sm text-warning-dark">
                            {disbursement.rejectionReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Approval Info (if approved/completed) */}
                  {(disbursement.status === "APPROVED" ||
                    disbursement.status === "COMPLETED") &&
                    disbursement.approvedByUser && (
                      <div className="bg-success-light border border-success rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                          <div className="text-sm">
                            <p className="text-success-dark">
                              <span className="font-semibold">Approved by:</span>{" "}
                              {disbursement.approvedByUser.firstName} {disbursement.approvedByUser.lastName}
                            </p>
                            {disbursement.approvedAt && (
                              <p className="text-success-dark">
                                {formatRelativeTime(new Date(disbursement.approvedAt))}
                              </p>
                            )}
                            {disbursement.disbursementDate && (
                              <p className="text-success-dark mt-1">
                                <span className="font-semibold">Paid out:</span>{" "}
                                {formatRelativeTime(new Date(disbursement.disbursementDate))}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Actions (only for pending) */}
                  {disbursement.status === "PENDING" && (
                    <div className="flex gap-3 pt-2">
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setSelectedDisbursement(disbursement);
                          setIsApproveDialogOpen(true);
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-warning text-warning hover:bg-warning-light"
                        onClick={() => {
                          setSelectedDisbursement(disbursement);
                          setIsRejectDialogOpen(true);
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                      <Button variant="outline" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Payout is the separate, explicit step that moves the money */}
                  {disbursement.status === "APPROVED" && (
                    <div className="flex gap-3 pt-2">
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setSelectedDisbursement(disbursement);
                          setIsPayoutDialogOpen(true);
                        }}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send Payout
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredDisbursements.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No disbursements found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Disbursement</DialogTitle>
            <DialogDescription>
              Approving records your decision but does not move any money. You
              will send the payout as a separate step.
            </DialogDescription>
          </DialogHeader>
          {selectedDisbursement && (
            <div className="space-y-3 py-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(Number(selectedDisbursement.requestedAmount))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Campaign</p>
                <p className="font-semibold text-foreground">
                  {selectedDisbursement.bankingAccount.campaign.teamName}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Purpose</p>
                <p className="text-foreground">{selectedDisbursement.purpose}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={actionLoading}>
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Disbursement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payout Dialog */}
      <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Payout</DialogTitle>
            <DialogDescription>
              This transfers the funds to the campaign&apos;s payout account and
              cannot be undone from here.
            </DialogDescription>
          </DialogHeader>
          {selectedDisbursement && (
            <div className="space-y-3 py-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(Number(selectedDisbursement.requestedAmount))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Campaign</p>
                <p className="font-semibold text-foreground">
                  {selectedDisbursement.bankingAccount.campaign.teamName}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Purpose</p>
                <p className="text-foreground">{selectedDisbursement.purpose}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPayoutDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handlePayout} disabled={actionLoading}>
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Payout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Disbursement</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this disbursement request.
            </DialogDescription>
          </DialogHeader>
          {selectedDisbursement && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(Number(selectedDisbursement.requestedAmount))}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedDisbursement.bankingAccount.campaign.teamName}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Rejection Reason *
                </label>
                <Textarea
                  placeholder="Explain why this request is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  disabled={actionLoading}
                />
                <p
                  className={`text-xs mt-2 ${
                    rejectionReason.trim().length < MIN_REJECTION_REASON_LENGTH
                      ? "text-muted-foreground"
                      : "text-success"
                  }`}
                >
                  {rejectionReason.trim().length < MIN_REJECTION_REASON_LENGTH
                    ? `Please provide at least ${MIN_REJECTION_REASON_LENGTH} characters (${rejectionReason.trim().length}/${MIN_REJECTION_REASON_LENGTH})`
                    : "Reason meets the minimum length"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectionReason("");
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={
                rejectionReason.trim().length < MIN_REJECTION_REASON_LENGTH ||
                actionLoading
              }
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Disbursement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
