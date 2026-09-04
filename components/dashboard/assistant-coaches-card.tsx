"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SECTION_TITLE =
  "flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-[0.04em]";

type Coach = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type PendingInvite = {
  id: string;
  email: string;
  expiresAt: string;
  expired: boolean;
};

export function AssistantCoachesCard({
  campaignId,
  csrfToken,
}: {
  campaignId: string;
  csrfToken: string;
}) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [canInvite, setCanInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/coaches`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to load assistant coaches");
      }
      setCoaches(result.coaches || []);
      setPending(result.pendingInvites || []);
      setCanInvite(!!result.canInvite);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coaches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const invite = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/coaches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to send invite");
      }
      setEmail("");
      setNotice(
        result.status === "connected"
          ? "Assistant coach added"
          : "Invitation sent"
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (userId: string) => {
    setRemovingId(userId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/coaches/${userId}`,
        {
          method: "DELETE",
          headers: { "x-csrf-token": csrfToken },
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to remove coach");
      }
      setNotice("Assistant coach removed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove coach");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className={SECTION_TITLE}>
          <UserPlus className="w-5 h-5" />
          Assistant coaches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {coaches.length === 0 && pending.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No assistant coaches yet. Invite someone to help run this campaign.
              </p>
            )}
            {coaches.length > 0 && (
              <ul className="space-y-2">
                {coaches.map((coach) => (
                  <li
                    key={coach.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>
                      {coach.firstName} {coach.lastName}{" "}
                      <span className="text-muted-foreground">
                        ({coach.email})
                      </span>
                    </span>
                    {canInvite && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(coach.id)}
                        disabled={removingId === coach.id || !csrfToken}
                        aria-label={`Remove ${coach.firstName}`}
                      >
                        {removingId === coach.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {pending.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
                  Pending invites
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {pending.map((invite) => (
                    <li key={invite.id}>
                      {invite.email}
                      {invite.expired ? " — expired" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {canInvite && (
          <div className="space-y-2">
            <Label htmlFor="assistantCoachEmail">Invite by email</Label>
            <div className="flex gap-2">
              <Input
                id="assistantCoachEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@example.com"
              />
              <Button
                size="sm"
                onClick={invite}
                disabled={saving || !email || !csrfToken}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Invite"
                )}
              </Button>
            </div>
          </div>
        )}
        {notice && (
          <p role="status" className="text-sm text-success-dark">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
