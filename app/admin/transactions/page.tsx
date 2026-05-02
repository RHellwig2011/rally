"use client";

import { useState } from "react";
import {
  Wallet,
  Search,
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";

// Mock data - will be replaced with database queries
const getTransactions = () => {
  return [
    {
      id: "1",
      type: "DEPOSIT",
      amount: 10000,
      balanceAfter: 682000,
      campaign: "Lincoln High Robotics",
      donor: "Jennifer Martinez",
      description: "Donation received",
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      metadata: {
        platformFee: 1000,
        processingFee: 300,
        netAmount: 8700,
      },
    },
    {
      id: "2",
      type: "FEE_COLLECTION",
      amount: 1000,
      balanceAfter: 673000,
      campaign: "Lincoln High Robotics",
      description: "Platform fee collected (10%)",
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      metadata: {
        relatedDonation: "DON-001",
      },
    },
    {
      id: "3",
      type: "DEPOSIT",
      amount: 5000,
      balanceAfter: 678000,
      campaign: "West Valley Soccer",
      donor: "Anonymous",
      description: "Donation received",
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      metadata: {
        platformFee: 500,
        processingFee: 150,
        netAmount: 4350,
      },
    },
    {
      id: "4",
      type: "DISBURSEMENT",
      amount: -25000,
      balanceAfter: 391000,
      campaign: "Central Arts Program",
      description: "Disbursement - Art supplies purchase",
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      metadata: {
        approvedBy: "Bank Admin",
        requestedBy: "Sarah Johnson",
      },
    },
    {
      id: "5",
      type: "DEPOSIT",
      amount: 7500,
      balanceAfter: 416000,
      campaign: "Central Arts Program",
      donor: "David & Sarah Kim",
      description: "Donation received",
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      metadata: {
        platformFee: 750,
        processingFee: 225,
        netAmount: 6525,
      },
    },
    {
      id: "6",
      type: "REFUND",
      amount: -3000,
      balanceAfter: 413000,
      campaign: "East Side Band",
      donor: "Michael Johnson",
      description: "Donation refunded - duplicate charge",
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      metadata: {
        reason: "Duplicate charge",
        originalDonation: "DON-045",
      },
    },
    {
      id: "7",
      type: "DEPOSIT",
      amount: 50000,
      balanceAfter: 595000,
      campaign: "West Valley Soccer",
      donor: "Anonymous",
      description: "Large donation received",
      createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
      metadata: {
        platformFee: 5000,
        processingFee: 1500,
        netAmount: 43500,
      },
    },
    {
      id: "8",
      type: "DISBURSEMENT",
      amount: -15000,
      balanceAfter: 78500,
      campaign: "Lincoln High Robotics",
      description: "Disbursement - Team uniforms",
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      metadata: {
        approvedBy: "Bank Admin",
        requestedBy: "Alex Thompson",
      },
    },
  ];
};

const transactionTypeConfig = {
  DEPOSIT: {
    label: "Deposit",
    icon: TrendingUp,
    color: "text-success",
    bgColor: "bg-success-100",
  },
  DISBURSEMENT: {
    label: "Disbursement",
    icon: ArrowUpRight,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  FEE_COLLECTION: {
    label: "Fee Collection",
    icon: DollarSign,
    color: "text-warning",
    bgColor: "bg-yellow-100",
  },
  REFUND: {
    label: "Refund",
    icon: TrendingDown,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  ADJUSTMENT: {
    label: "Adjustment",
    icon: ArrowDownRight,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
};

export default function AdminTransactionsPage() {
  const transactions = getTransactions();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<string>("ALL");

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch =
      transaction.campaign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.donor?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === "ALL" || transaction.type === typeFilter;

    let matchesDate = true;
    if (dateRange === "TODAY") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      matchesDate = transaction.createdAt >= today;
    } else if (dateRange === "WEEK") {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = transaction.createdAt >= weekAgo;
    } else if (dateRange === "MONTH") {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      matchesDate = transaction.createdAt >= monthAgo;
    }

    return matchesSearch && matchesType && matchesDate;
  });

  // Calculate stats
  const stats = {
    totalDeposits: transactions
      .filter((t) => t.type === "DEPOSIT")
      .reduce((sum, t) => sum + t.amount, 0),
    totalDisbursements: Math.abs(
      transactions
        .filter((t) => t.type === "DISBURSEMENT")
        .reduce((sum, t) => sum + t.amount, 0)
    ),
    totalFees: transactions
      .filter((t) => t.type === "FEE_COLLECTION")
      .reduce((sum, t) => sum + t.amount, 0),
    totalRefunds: Math.abs(
      transactions
        .filter((t) => t.type === "REFUND")
        .reduce((sum, t) => sum + t.amount, 0)
    ),
    depositCount: transactions.filter((t) => t.type === "DEPOSIT").length,
    disbursementCount: transactions.filter((t) => t.type === "DISBURSEMENT")
      .length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Transaction Monitor
        </h1>
        <p className="text-gray-600">
          Track all financial transactions across the platform
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Deposits
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.totalDeposits)}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {stats.depositCount} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Disbursements
            </CardTitle>
            <ArrowUpRight className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.totalDisbursements)}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {stats.disbursementCount} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Platform Fees
            </CardTitle>
            <DollarSign className="w-5 h-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.totalFees)}
            </div>
            <p className="text-sm text-gray-500 mt-1">10% of deposits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Refunds
            </CardTitle>
            <TrendingDown className="w-5 h-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.totalRefunds)}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {transactions.filter((t) => t.type === "REFUND").length} refunds
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search campaigns, donors, or descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ALL">All Types</option>
                <option value="DEPOSIT">Deposits</option>
                <option value="DISBURSEMENT">Disbursements</option>
                <option value="FEE_COLLECTION">Fee Collections</option>
                <option value="REFUND">Refunds</option>
                <option value="ADJUSTMENT">Adjustments</option>
              </select>

              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="WEEK">Last 7 Days</option>
                <option value="MONTH">Last 30 Days</option>
              </select>

              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            All Transactions ({filteredTransactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0 divide-y">
            {filteredTransactions.map((transaction) => {
              const config =
                transactionTypeConfig[
                  transaction.type as keyof typeof transactionTypeConfig
                ];
              const Icon = config.icon;
              const isNegative = transaction.amount < 0;

              return (
                <div
                  key={transaction.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 py-4 first:pt-0"
                >
                  {/* Left Side - Type & Details */}
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} font-medium whitespace-nowrap`}
                        >
                          {config.label}
                        </span>
                        <h4 className="font-semibold text-gray-900 truncate">
                          {transaction.campaign}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {transaction.description}
                      </p>
                      {transaction.donor && (
                        <p className="text-xs text-gray-500">
                          Donor: {transaction.donor}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatRelativeTime(transaction.createdAt)}
                        </span>
                        {transaction.metadata && (
                          <>
                            {transaction.metadata.platformFee && (
                              <span>
                                Platform Fee:{" "}
                                {formatCurrency(transaction.metadata.platformFee)}
                              </span>
                            )}
                            {transaction.metadata.approvedBy && (
                              <span>
                                Approved by: {transaction.metadata.approvedBy}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Amount & Balance */}
                  <div className="sm:text-right pl-14 sm:pl-0">
                    <div
                      className={`text-xl font-bold mb-1 ${
                        isNegative ? "text-blue-600" : "text-success"
                      }`}
                    >
                      {isNegative ? "-" : "+"}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </div>
                    <div className="text-sm text-gray-500">
                      Balance: {formatCurrency(transaction.balanceAfter)}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No transactions found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
