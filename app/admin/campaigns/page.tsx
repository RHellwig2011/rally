"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, calculatePercentage } from "@/lib/utils";

// Mock data - will be replaced with database queries
const getCampaigns = () => {
  return [
    {
      id: "1",
      organizationName: "Lincoln High School",
      teamName: "Robotics Team",
      slug: "lincoln-high-robotics",
      status: "ACTIVE",
      goalAmount: 1200000,
      currentAmount: 845000,
      platformFees: 84500,
      availableBalance: 682000,
      donorCount: 142,
      leader: {
        name: "Alex Thompson",
        email: "alex@lincolnhigh.edu",
      },
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
    },
    {
      id: "2",
      organizationName: "West Valley Middle School",
      teamName: "Soccer Team",
      slug: "west-valley-soccer",
      status: "ACTIVE",
      goalAmount: 750000,
      currentAmount: 680000,
      platformFees: 68000,
      availableBalance: 545000,
      donorCount: 98,
      leader: {
        name: "Mike Davis",
        email: "mdavis@westvalley.edu",
      },
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    },
    {
      id: "3",
      organizationName: "Central Elementary",
      teamName: "Arts Program",
      slug: "central-arts",
      status: "ACTIVE",
      goalAmount: 600000,
      currentAmount: 520000,
      platformFees: 52000,
      availableBalance: 416000,
      donorCount: 187,
      leader: {
        name: "Sarah Johnson",
        email: "sjohnson@central.edu",
      },
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: "4",
      organizationName: "East Side High",
      teamName: "Band Trip",
      slug: "eastside-band",
      status: "COMPLETED",
      goalAmount: 800000,
      currentAmount: 850000,
      platformFees: 85000,
      availableBalance: 0,
      donorCount: 215,
      leader: {
        name: "Jennifer Martinez",
        email: "jmartinez@eastside.edu",
      },
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: "5",
      organizationName: "North High School",
      teamName: "Tennis Team",
      slug: "north-tennis",
      status: "PAUSED",
      goalAmount: 500000,
      currentAmount: 280000,
      platformFees: 28000,
      availableBalance: 224000,
      donorCount: 64,
      leader: {
        name: "David Kim",
        email: "dkim@northhigh.edu",
      },
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
    },
  ];
};

const statusConfig = {
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

export default function AdminCampaignsPage() {
  const campaigns = getCampaigns();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.leader.name.toLowerCase().includes(searchQuery.toLowerCase());

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">All Campaigns</h1>
        <p className="text-gray-600">Manage and monitor all fundraising campaigns</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Campaigns</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{stats.active}</div>
            <div className="text-sm text-gray-600">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{stats.paused}</div>
            <div className="text-sm text-gray-600">Paused</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">
              {stats.completed}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
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

      {/* Campaigns List */}
      <div className="space-y-4">
        {filteredCampaigns.map((campaign) => {
          const percentage = calculatePercentage(
            campaign.currentAmount,
            campaign.goalAmount
          );
          const StatusIcon = statusConfig[campaign.status as keyof typeof statusConfig].icon;
          const daysLeft = Math.ceil(
            (campaign.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          return (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Campaign Info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {campaign.organizationName} - {campaign.teamName}
                          </h3>
                          <span
                            className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                              statusConfig[campaign.status as keyof typeof statusConfig]
                                .bgColor
                            } ${
                              statusConfig[campaign.status as keyof typeof statusConfig]
                                .color
                            }`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig[campaign.status as keyof typeof statusConfig].label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                          <span>Leader: {campaign.leader.name}</span>
                          <span>•</span>
                          <span>{campaign.donorCount} donors</span>
                          <span>•</span>
                          <span>
                            {daysLeft > 0 ? `${daysLeft} days left` : "Ended"}
                          </span>
                        </div>

                        {/* Progress */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(campaign.currentAmount)} raised
                            </span>
                            <span className="text-gray-600">
                              Goal: {formatCurrency(campaign.goalAmount)}
                            </span>
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

                        {/* Financial Details */}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Platform Fees: </span>
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(campaign.platformFees)}
                            </span>
                          </div>
                          <span className="text-gray-300">|</span>
                          <div>
                            <span className="text-gray-600">Available: </span>
                            <span className="font-semibold text-success">
                              {formatCurrency(campaign.availableBalance)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/raise/${campaign.slug}`}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/${campaign.id}`}>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Dashboard
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm">
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
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No campaigns found</p>
                <p className="text-sm text-gray-500 mt-1">
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
