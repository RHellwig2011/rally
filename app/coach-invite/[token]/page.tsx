"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCsrfToken } from "@/hooks/useCsrfToken";

type InviteInfo = {
  email: string;
  expired: boolean;
  accepted: boolean;
  campaignName: string;
  inviterName: string;
};

export default function CoachInvitePage() {
  const params = useParams();
  const token = params?.token as string;
  const { csrfToken } = useCsrfToken();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const [inviteRes, meRes] = await Promise.all([
          fetch(`/api/coach-invites/${token}`),
          fetch("/api/auth/me"),
        ]);
        const inviteJson = await inviteRes.json();
        if (!inviteRes.ok || !inviteJson.success) {
          throw new Error(inviteJson.error || "Invitation not found");
        }
        if (!cancelled) {
          setInfo(inviteJson.invite);
          setSignedIn(meRes.ok);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load invitation"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/coach-invites/${token}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to accept invitation");
      }
      setAccepted(true);
    } catch (err) {
      setAcceptError(
        err instanceof Error ? err.message : "Failed to accept invitation"
      );
    } finally {
      setAccepting(false);
    }
  };

  const next = `/login?next=${encodeURIComponent(`/coach-invite/${token}`)}`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Assistant coach invitation</CardTitle>
          <CardDescription>
            Join a campaign as an assistant coach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading invitation…
            </p>
          )}
          {loadError && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {loadError}
            </p>
          )}
          {info && !accepted && (
            <>
              <p className="text-sm">
                <strong>{info.inviterName || "A coach"}</strong> invited you to
                help run <strong>{info.campaignName}</strong>.
              </p>
              {info.accepted && (
                <p className="text-sm text-muted-foreground">
                  This invitation has already been accepted.
                </p>
              )}
              {info.expired && !info.accepted && (
                <p className="text-sm text-muted-foreground">
                  This invitation has expired. Ask the head coach to send a new one.
                </p>
              )}
              {!info.expired && !info.accepted && !signedIn && (
                <Button asChild>
                  <Link href={next}>Sign in to accept</Link>
                </Button>
              )}
              {!info.expired && !info.accepted && signedIn && (
                <Button onClick={accept} disabled={accepting || !csrfToken}>
                  {accepting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Accept invitation
                </Button>
              )}
              {acceptError && (
                <p role="alert" className="text-sm text-destructive">
                  {acceptError}
                </p>
              )}
            </>
          )}
          {accepted && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success" />
                You&apos;re an assistant coach now.
              </p>
              <Button asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
