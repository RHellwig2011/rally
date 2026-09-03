"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Heart,
  MessageSquare,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCsrfToken } from "@/hooks/useCsrfToken";

interface CheerMessage {
  id: string;
  authorName: string;
  message: string;
  isAnonymous: boolean;
  isApproved: boolean;
  isFlagged: boolean;
  createdAt: string;
}

type FilterTab = "pending" | "approved" | "all";

export default function CheerWallModerationPage() {
  const params = useParams();
  const campaignId = params?.campaignId as string;
  const { csrfToken } = useCsrfToken();

  const [messages, setMessages] = useState<CheerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/campaigns/${campaignId}/cheer-messages`);
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
      } else {
        setError(data.error || "Failed to load cheer messages");
      }
    } catch {
      setError("Failed to load cheer messages");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) fetchMessages();
  }, [campaignId, fetchMessages]);

  const moderate = async (messageId: string, isApproved: boolean) => {
    setBusyId(messageId);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/cheer-messages/${messageId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({ isApproved }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isApproved } : m))
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (messageId: string) => {
    if (!window.confirm("Delete this message permanently?")) return;
    setBusyId(messageId);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/cheer-messages/${messageId}`,
        {
          method: "DELETE",
          headers: { "x-csrf-token": csrfToken },
        }
      );
      const data = await response.json();
      if (data.success) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = messages.filter((m) => !m.isApproved).length;
  const approvedCount = messages.length - pendingCount;

  const visible = messages.filter((m) => {
    if (filter === "pending") return !m.isApproved;
    if (filter === "approved") return m.isApproved;
    return true;
  });

  const tabs: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "approved", label: "Approved", count: approvedCount },
    { id: "all", label: "All", count: messages.length },
  ];

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={`/dashboard/${campaignId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Heart className="w-8 h-8 text-primary" />
            Cheer Wall Moderation
          </h1>
          <p className="text-muted-foreground">
            Approve supporter messages so they appear on your public campaign page
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === tab.id
                  ? "bg-primary text-white"
                  : "bg-white text-muted-foreground border border-border hover:border-primary-200"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-warning mb-4">{error}</p>
              <Button onClick={fetchMessages}>Try Again</Button>
            </CardContent>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {filter === "pending"
                  ? "No messages waiting for review"
                  : "No messages here yet"}
              </h3>
              <p className="text-muted-foreground">
                When supporters leave cheer messages on your campaign page, they
                will show up here for approval.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {visible.map((msg) => (
              <Card key={msg.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {msg.authorName}
                      {msg.isApproved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success-light px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#E8A33D] bg-[rgba(232,163,61,.14)] px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground mb-4 whitespace-pre-wrap">{msg.message}</p>
                  <div className="flex gap-2">
                    {msg.isApproved ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === msg.id}
                        onClick={() => moderate(msg.id, false)}
                      >
                        <Undo2 className="w-4 h-4 mr-2" />
                        Unapprove
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busyId === msg.id}
                        onClick={() => moderate(msg.id, true)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === msg.id}
                      onClick={() => remove(msg.id)}
                      className="text-warning hover:text-warning"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
