"use client";

import { useState } from "react";
import { useCsrfToken } from "@/hooks/useCsrfToken";

export function InviteContactsButton({ teamMemberId }: { teamMemberId: string }) {
  const { csrfToken } = useCsrfToken();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createAndCopy() {
    if (!csrfToken) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/team-members/${teamMemberId}/contact-invite`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ role: "PLAYER" }),
      });
      const data = await res.json();
      const token = data.invite?.token || data.token;
      if (!res.ok || !token) {
        throw new Error(data.error || "Could not create invite");
      }
      const url = `${window.location.origin}/contribute/${token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={createAndCopy}
      disabled={busy || !csrfToken}
      className="flex-1 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted transition-colors disabled:opacity-50"
    >
      {copied ? "Link copied" : busy ? "Creating…" : "Invite contacts"}
    </button>
  );
}
