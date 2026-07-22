"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Search,
  Filter,
  Eye,
  MoreVertical,
  CheckCircle,
  Clock,
  Pause,
  Archive,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AdminCampaign {
  id: string;
  organizationName: string;
  teamName: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  goalAmount: number; // dollars
  currentAmount: number; // dollars
  progress: number; // percent
  banking: {
    totalRaised: number;
    platformFeesCollected: number;
    availableBalance: number;
    disbursedTotal: number;
    pendingDisbursement: number;
  } | null;
  teamMemberCount: number;
  donationCount: number;
  uniqueDonorCount: number;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number | null;
  createdAt: string;
  updatedAt: string;
  primaryLeader: {
    id: string;
    name: string;
    email: string;
  };
}

// API returns dollar amounts (already converted from cents server-side)
function formatDollars(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

interface StatusConfigEntry {
  label: string;
  icon: typeof CheckCircle;
  color: string;
  bgColor: string;
}

const statusConfig: Record<string, StatusConfigEntry> = {
  ACTIVE: {
    label: "Active",
    icon: CheckCircle,
    color: "text-success",
    bgColor: "bg-success-100",
  },
  PAUSED: {
    label: "Paused",
    icon: Pause,
    color: "text-warning",
    bgColor: "bg-yellow-100",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  DRAFT: {
    label: "Draft",
    icon: Clock,
    color: "text-gray-400",
    bgColor: "bg-gray-50",
  },
  ARCHIVED: {
    label: "Archived",
    icon: Archive,
    color: "text-gray-400",
    bgColor: "bg-gray-50",
  },
};

function getStatusConfig(status: string): StatusConfigEntry {
  return (
    statusConfig[status] ?? {
      label: status,
      icon: Clock,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    }
  );
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/campaigns?limit=100");
      if (!response.ok) {
        throw new Error("Failed to fetch campaigns");
      }

      const data = await response.json();
      if (data.success) {
        setCampaigns(data.campaigns || []);
      } else {
        throw new Error(data.error || "Failed to load campaigns");
      }
    } catch (err) {
      console.error("Error fetching campaigns:", err);
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  const filteredCampaigns = campaigns.filter((campaign) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      campaign.teamName.toLowerCase().includes(query) ||
      campaign.organizationName.toLowerCase().includes(query) ||
      campaign.primaryLeader.name.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "ALL" || campaign.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === "ACTIVE").length,
    paused: campaigns.filter((c) => c.status === "PAUSED").length,
    completed: campaigns.filter((c) => c.status === "COMPLETED").length,
  };

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  if (error && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-foreground font-semibold mb-2">Failed to load campaigns</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchCampaigns()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">All Campaigns</h1>
        <p className="text-muted-foreground">Manage and monitor all fundraising campaigns</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Campaigns</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{stats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{stats.paused}</div>
            <div className="text-sm text-muted-foreground">Paused</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-muted-foreground">
              {stats.completed}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
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
                placeholder="Search campaigns, organizations, or leaders..."
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
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error banner (when data already loaded) */}
      {error && campaigns.length > 0 && (
        <div className="mb-6 bg-warning-light border border-warning rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning" />
          <p className="text-warning-dark font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchCampaigns()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Campaigns List */}
      <div className="space-y-4">
        {filteredCampaigns.map((campaign) => {
          const config = getStatusConfig(campaign.status);
          const StatusIcon = config.icon;
          const percentage = campaign.progress;
          const daysRemaining = campaign.daysRemaining;

          return (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Campaign Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground truncate">
                            {campaign.organizationName} - {campaign.teamName}
                          </h3>
                          <span
                            className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 self-start ${config.bgColor} ${config.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                          <span>Leader: {campaign.primaryLeader.name}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{campaign.uniqueDonorCount} donors</span>
                          <span className="hidden sm:inline">•</span>
                          <span>
                            {daysRemaining === null
                              ? "No end date"
                              : daysRemaining > 0
                                ? `${daysRemaining} days left`
                                : "Ended"}
                          </span>
                        </div>

                        {/* Progress */}
                        <div className="space-y-2 mb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-sm">
                            <span className="font-semibold text-foreground">
                              {formatDollars(campaign.currentAmount)} raised
                            </span>
                            <span className="text-muted-foreground">
                              Goal: {formatDollars(campaign.goalAmount)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-accent rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2 transition-all"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-primary whitespace-nowrap">
                              {percentage}%
                            </span>
                          </div>
                        </div>

                        {/* Financial Details */}
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Platform Fees: </span>
                            <span className="font-semibold text-foreground">
                              {formatDollars(campaign.banking?.platformFeesCollected ?? 0)}
                            </span>
                          </div>
                          <span className="text-muted-foreground hidden sm:inline">|</span>
                          <div>
                            <span className="text-muted-foreground">Available: </span>
                            <span className="font-semibold text-success">
                              {formatDollars(campaign.banking?.availableBalance ?? 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col gap-2">
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-initial" asChild>
                      <Link href={`/raise/${campaign.slug}`}>
                        <Eye className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">View</span>
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-initial" asChild>
                      <Link href={`/dashboard/${campaign.id}`}>
                        <TrendingUp className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Dashboard</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="sm:w-full">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredCampaigns.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No campaigns found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
