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

interface Disbursement {
  id: string;
  requestedAmount: number | bigint;
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
    availableBalance: bigint;
    campaign: {
      id: string;
      teamName: string;
      organizationName: string;
    };
  };
}

const statusConfig = {
  PENDING: {
    label: "Pending Review",
    icon: Clock,
    color: "text-warning",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
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

export default function AdminDisbursementsPage() {
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
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
        },
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

  async function handleReject() {
    if (!selectedDisbursement || !rejectionReason.trim()) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/disbursements/${selectedDisbursement.id}/reject`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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
          <p className="text-gray-600">Loading disbursements...</p>
        </div>
      </div>
    );
  }

  if (error && disbursements.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Failed to load disbursements</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => fetchDisbursements()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Disbursement Approvals
        </h1>
        <p className="text-gray-600">
          Review and approve fund disbursement requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {stats.approved}
            </div>
            <div className="text-sm text-gray-600">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">
              {stats.completed}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(stats.totalPendingAmount)}
            </div>
            <div className="text-sm text-gray-600">Pending Amount</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
          const config =
            statusConfig[disbursement.status as keyof typeof statusConfig];
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
                        <h3 className="text-lg font-semibold text-gray-900">
                          {formatCurrency(Number(disbursement.requestedAmount) * 100)}
                        </h3>
                      </div>
                      <h4 className="text-base font-semibold text-gray-700 mb-1">
                        {disbursement.bankingAccount.campaign.teamName}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {disbursement.bankingAccount.campaign.organizationName}
                      </p>
                    </div>
                  </div>

                  {/* Purpose & Description */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="font-semibold text-gray-900 mb-1">
                      Purpose: {disbursement.purpose}
                    </h5>
                    <p className="text-sm text-gray-600">
                      {disbursement.description}
                    </p>
                  </div>

                  {/* Details Grid */}
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <User className="w-4 h-4" />
                        <span className="font-medium">Requested By:</span>
                      </div>
                      <p className="text-gray-900">
                        {disbursement.requestedByUser.firstName} {disbursement.requestedByUser.lastName}
                      </p>
                      <p className="text-gray-500">
                        {disbursement.requestedByUser.email}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">Requested:</span>
                      </div>
                      <p className="text-gray-900">
                        {formatRelativeTime(new Date(disbursement.requestedAt))}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-medium">Available Balance:</span>
                      </div>
                      <p className="text-gray-900">
                        {formatCurrency(Number(disbursement.bankingAccount.availableBalance) * 100)}
                      </p>
                    </div>
                    {disbursement.receiptsUrls && disbursement.receiptsUrls.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
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
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                        <div>
                          <p className="font-semibold text-red-900 text-sm mb-1">
                            Rejection Reason:
                          </p>
                          <p className="text-sm text-red-800">
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
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="text-green-900">
                              <span className="font-semibold">Approved by:</span>{" "}
                              {disbursement.approvedByUser.firstName} {disbursement.approvedByUser.lastName}
                            </p>
                            {disbursement.approvedAt && (
                              <p className="text-green-800">
                                {formatRelativeTime(new Date(disbursement.approvedAt))}
                              </p>
                            )}
                            {disbursement.disbursementDate && (
                              <p className="text-green-800 mt-1">
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
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
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
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredDisbursements.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No disbursements found</p>
                <p className="text-sm text-gray-500 mt-1">
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
              Are you sure you want to approve this disbursement request?
            </DialogDescription>
          </DialogHeader>
          {selectedDisbursement && (
            <div className="space-y-3 py-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(Number(selectedDisbursement.requestedAmount) * 100)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Campaign</p>
                <p className="font-semibold text-gray-900">
                  {selectedDisbursement.bankingAccount.campaign.teamName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Purpose</p>
                <p className="text-gray-900">{selectedDisbursement.purpose}</p>
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
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Amount</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(Number(selectedDisbursement.requestedAmount) * 100)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {selectedDisbursement.bankingAccount.campaign.teamName}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Rejection Reason *
                </label>
                <Textarea
                  placeholder="Explain why this request is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  disabled={actionLoading}
                />
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
              disabled={!rejectionReason.trim() || actionLoading}
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
