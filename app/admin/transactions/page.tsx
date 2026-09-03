"use client";

import { useState, useEffect, useCallback } from "react";
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
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";

interface AdminTransaction {
  id: string;
  type: string;
  amount: number; // cents
  balanceAfter: number; // cents
  description: string;
  createdAt: string;
  campaign: {
    id: string;
    teamName: string;
    organizationName: string;
    slug: string;
    name: string;
  } | null;
  donor: string | null;
  metadata: Record<string, unknown> | null;
}

interface TypeSummary {
  type: string;
  totalAmount: number; // cents
  count: number;
}

interface TypeConfigEntry {
  label: string;
  icon: typeof TrendingUp;
  color: string;
  bgColor: string;
}

const transactionTypeConfig: Record<string, TypeConfigEntry> = {
  DEPOSIT: {
    label: "Deposit",
    icon: TrendingUp,
    color: "text-success",
    bgColor: "bg-success-100",
  },
  DISBURSEMENT: {
    label: "Disbursement",
    icon: ArrowUpRight,
    color: "text-secondary",
    bgColor: "bg-white/[0.08]",
  },
  FEE_COLLECTION: {
    label: "Fee Collection",
    icon: DollarSign,
    color: "text-warning",
    bgColor: "bg-[rgba(232,163,61,.14)]",
  },
  REFUND: {
    label: "Refund",
    icon: TrendingDown,
    color: "text-destructive",
    bgColor: "bg-[rgba(242,97,75,.14)]",
  },
  ADJUSTMENT: {
    label: "Adjustment",
    icon: ArrowDownRight,
    color: "text-muted-foreground",
    bgColor: "bg-white/[0.06]",
  },
};

function getTypeConfig(type: string): TypeConfigEntry {
  return (
    transactionTypeConfig[type] ?? {
      label: type,
      icon: Wallet,
      color: "text-muted-foreground",
      bgColor: "bg-white/[0.06]",
    }
  );
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [summary, setSummary] = useState<TypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<string>("ALL");

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ limit: "100" });
      if (typeFilter !== "ALL") params.set("type", typeFilter);

      const response = await fetch(`/api/admin/transactions?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions || []);
        setSummary(data.summary?.byType || []);
      } else {
        throw new Error(data.error || "Failed to load transactions");
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  /** Escape a value for RFC-4180 CSV output. */
  function csvCell(value: unknown): string {
    const s = value === null || value === undefined ? "" : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  }

  const filteredTransactions = transactions.filter((transaction) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      (transaction.campaign?.name.toLowerCase().includes(query) ?? false) ||
      transaction.description.toLowerCase().includes(query) ||
      (transaction.donor?.toLowerCase().includes(query) ?? false);

    let matchesDate = true;
    const createdAt = new Date(transaction.createdAt);
    if (dateRange === "TODAY") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      matchesDate = createdAt >= today;
    } else if (dateRange === "WEEK") {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = createdAt >= weekAgo;
    } else if (dateRange === "MONTH") {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      matchesDate = createdAt >= monthAgo;
    }

    return matchesSearch && matchesDate;
  });

  /** Export the currently filtered rows as a CSV download (amounts in dollars). */
  function handleExportCsv() {
    const headers = [
      "Date",
      "Type",
      "Campaign",
      "Description",
      "Donor",
      "Amount (USD)",
      "Balance After (USD)",
    ];

    const rows = filteredTransactions.map((t) => [
      new Date(t.createdAt).toISOString(),
      t.type,
      t.campaign?.name ?? "",
      t.description,
      t.donor ?? "",
      (t.amount / 100).toFixed(2),
      (t.balanceAfter / 100).toFixed(2),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Platform-wide stats from server summary (all transactions, not just this page)
  const byType = (type: string) => summary.find((s) => s.type === type);
  const stats = {
    totalDeposits: byType("DEPOSIT")?.totalAmount ?? 0,
    totalDisbursements: Math.abs(byType("DISBURSEMENT")?.totalAmount ?? 0),
    totalFees: byType("FEE_COLLECTION")?.totalAmount ?? 0,
    totalRefunds: Math.abs(byType("REFUND")?.totalAmount ?? 0),
    depositCount: byType("DEPOSIT")?.count ?? 0,
    disbursementCount: byType("DISBURSEMENT")?.count ?? 0,
    refundCount: byType("REFUND")?.count ?? 0,
  };

  if (loading && transactions.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Transaction Monitor
        </h1>
        <p className="text-muted-foreground">
          Track all financial transactions across the platform
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-warning-light border border-warning rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning" />
          <p className="text-warning-dark font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchTransactions()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Total Deposits
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.totalDeposits)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.depositCount} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Total Disbursements
            </CardTitle>
            <ArrowUpRight className="w-5 h-5 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.totalDisbursements)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.disbursementCount} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Platform Fees
            </CardTitle>
            <DollarSign className="w-5 h-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.totalFees)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Collected from deposits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Refunds
            </CardTitle>
            <TrendingDown className="w-5 h-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.totalRefunds)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.refundCount} refunds
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns, donors, or descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={handleExportCsv}
                disabled={filteredTransactions.length === 0}
              >
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
              const config = getTypeConfig(transaction.type);
              const Icon = config.icon;
              const isNegative = transaction.amount < 0;
              const metadata = transaction.metadata;
              const platformFee =
                metadata && typeof metadata.platformFee === "number"
                  ? metadata.platformFee
                  : null;
              const approvedBy =
                metadata && typeof metadata.approvedBy === "string"
                  ? metadata.approvedBy
                  : null;

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
                        <h4 className="font-semibold text-foreground truncate">
                          {transaction.campaign?.name ?? "Unknown campaign"}
                        </h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {transaction.description}
                      </p>
                      {transaction.donor && (
                        <p className="text-xs text-muted-foreground">
                          Donor: {transaction.donor}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatRelativeTime(new Date(transaction.createdAt))}
                        </span>
                        {platformFee !== null && (
                          <span>
                            Platform Fee: {formatCurrency(platformFee)}
                          </span>
                        )}
                        {approvedBy && (
                          <span>Approved by: {approvedBy}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Amount & Balance */}
                  <div className="sm:text-right pl-14 sm:pl-0">
                    <div
                      className={`text-xl font-bold mb-1 ${
                        isNegative ? "text-secondary" : "text-success"
                      }`}
                    >
                      {isNegative ? "-" : "+"}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Balance: {formatCurrency(transaction.balanceAfter)}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No transactions found</p>
                <p className="text-sm text-muted-foreground mt-1">
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
