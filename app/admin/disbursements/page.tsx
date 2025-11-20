"use client";

import { useState } from "react";
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

// Mock data - will be replaced with database queries
const getDisbursements = () => {
  return [
    {
      id: "1",
      campaign: {
        id: "c1",
        name: "Lincoln High Robotics",
        organization: "Lincoln High School",
      },
      requestedAmount: 50000,
      purpose: "Travel Deposit",
      description:
        "Deposit for competition travel to nationals. Need to secure hotel rooms and bus transportation.",
      receiptsUrls: [
        "/receipts/hotel-quote.pdf",
        "/receipts/bus-quote.pdf",
      ],
      requestedBy: {
        name: "Alex Thompson",
        email: "alex@lincolnhigh.edu",
        role: "CAMPAIGN_LEADER",
      },
      requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: "PENDING",
      availableBalance: 682000,
    },
    {
      id: "2",
      campaign: {
        id: "c2",
        name: "North High Tennis",
        organization: "North High School",
      },
      requestedAmount: 35000,
      purpose: "Equipment Purchase",
      description:
        "Purchase new tennis rackets and balls for the entire team. Current equipment is worn out.",
      receiptsUrls: ["/receipts/equipment-quote.pdf"],
      requestedBy: {
        name: "Sarah Johnson",
        email: "sjohnson@northhigh.edu",
        role: "CAMPAIGN_LEADER",
      },
      requestedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      status: "PENDING",
      availableBalance: 224000,
    },
    {
      id: "3",
      campaign: {
        id: "c3",
        name: "West Valley Soccer",
        organization: "West Valley Middle School",
      },
      requestedAmount: 28000,
      purpose: "Tournament Registration",
      description: "Registration fees for state tournament and referee costs.",
      receiptsUrls: ["/receipts/tournament-registration.pdf"],
      requestedBy: {
        name: "Mike Davis",
        email: "mdavis@westvalley.edu",
        role: "CAMPAIGN_LEADER",
      },
      requestedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      status: "PENDING",
      availableBalance: 545000,
    },
    {
      id: "4",
      campaign: {
        id: "c4",
        name: "Central Arts Program",
        organization: "Central Elementary",
      },
      requestedAmount: 25000,
      purpose: "Art Supplies",
      description: "Bulk purchase of paints, canvases, and art supplies for spring program.",
      receiptsUrls: ["/receipts/art-supplies.pdf"],
      requestedBy: {
        name: "Jennifer Lee",
        email: "jlee@central.edu",
        role: "CAMPAIGN_LEADER",
      },
      requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: "APPROVED",
      approvedBy: {
        name: "Bank Admin",
        email: "admin@rally.com",
      },
      approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      availableBalance: 416000,
    },
    {
      id: "5",
      campaign: {
        id: "c5",
        name: "East Side Band",
        organization: "East Side High",
      },
      requestedAmount: 45000,
      purpose: "Instrument Repair",
      description: "Repair and maintenance for band instruments.",
      receiptsUrls: [],
      requestedBy: {
        name: "David Kim",
        email: "dkim@eastside.edu",
        role: "CAMPAIGN_LEADER",
      },
      requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      status: "REJECTED",
      approvedBy: {
        name: "Bank Admin",
        email: "admin@rally.com",
      },
      approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      rejectionReason: "Insufficient documentation provided. Please submit detailed quotes from the repair shop.",
      availableBalance: 680000,
    },
    {
      id: "6",
      campaign: {
        id: "c1",
        name: "Lincoln High Robotics",
        organization: "Lincoln High School",
      },
      requestedAmount: 15000,
      purpose: "Team Uniforms",
      description: "Custom team uniforms and jackets for competition.",
      receiptsUrls: ["/receipts/uniform-order.pdf"],
      requestedBy: {
        name: "Alex Thompson",
        email: "alex@lincolnhigh.edu",
        role: "CAMPAIGN_LEADER",
      },
      requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: "COMPLETED",
      approvedBy: {
        name: "Bank Admin",
        email: "admin@rally.com",
      },
      approvedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      disbursementDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      availableBalance: 682000,
    },
  ];
};

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
  const disbursements = getDisbursements();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedDisbursement, setSelectedDisbursement] = useState<any>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const filteredDisbursements = disbursements.filter((disbursement) => {
    const matchesSearch =
      disbursement.campaign.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      disbursement.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      disbursement.requestedBy.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || disbursement.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: disbursements.filter((d) => d.status === "PENDING").length,
    approved: disbursements.filter((d) => d.status === "APPROVED").length,
    rejected: disbursements.filter((d) => d.status === "REJECTED").length,
    completed: disbursements.filter((d) => d.status === "COMPLETED").length,
    totalPendingAmount: disbursements
      .filter((d) => d.status === "PENDING")
      .reduce((sum, d) => sum + d.requestedAmount, 0),
  };

  const handleApprove = () => {
    console.log("Approving disbursement:", selectedDisbursement.id);
    alert(`Disbursement ${selectedDisbursement.id} approved! (Will save to database)`);
    setIsApproveDialogOpen(false);
    setSelectedDisbursement(null);
  };

  const handleReject = () => {
    console.log("Rejecting disbursement:", selectedDisbursement.id, rejectionReason);
    alert(`Disbursement ${selectedDisbursement.id} rejected! (Will save to database)`);
    setIsRejectDialogOpen(false);
    setSelectedDisbursement(null);
    setRejectionReason("");
  };

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
                          {formatCurrency(disbursement.requestedAmount)}
                        </h3>
                      </div>
                      <h4 className="text-base font-semibold text-gray-700 mb-1">
                        {disbursement.campaign.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {disbursement.campaign.organization}
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
                        {disbursement.requestedBy.name}
                      </p>
                      <p className="text-gray-500">
                        {disbursement.requestedBy.email}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">Requested:</span>
                      </div>
                      <p className="text-gray-900">
                        {formatRelativeTime(disbursement.requestedAt)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-medium">Available Balance:</span>
                      </div>
                      <p className="text-gray-900">
                        {formatCurrency(disbursement.availableBalance)}
                      </p>
                    </div>
                    {disbursement.receiptsUrls.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                          <FileCheck className="w-4 h-4" />
                          <span className="font-medium">Receipts:</span>
                        </div>
                        <div className="space-y-1">
                          {disbursement.receiptsUrls.map((url, idx) => (
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
                    disbursement.approvedBy && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="text-green-900">
                              <span className="font-semibold">Approved by:</span>{" "}
                              {disbursement.approvedBy.name}
                            </p>
                            <p className="text-green-800">
                              {formatRelativeTime(disbursement.approvedAt!)}
                            </p>
                            {disbursement.disbursementDate && (
                              <p className="text-green-800 mt-1">
                                <span className="font-semibold">Paid out:</span>{" "}
                                {formatRelativeTime(disbursement.disbursementDate)}
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
                  {formatCurrency(selectedDisbursement.requestedAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Campaign</p>
                <p className="font-semibold text-gray-900">
                  {selectedDisbursement.campaign.name}
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
            >
              Cancel
            </Button>
            <Button onClick={handleApprove}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Disbursement
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
                  {formatCurrency(selectedDisbursement.requestedAmount)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {selectedDisbursement.campaign.name}
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
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject Disbursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
