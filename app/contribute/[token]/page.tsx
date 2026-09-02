"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useCsrfToken } from "@/hooks/useCsrfToken";

/**
 * PUBLIC page. A parent opens this from a text message with no account and no
 * session, so it must never assume auth. Mobile-first: this is a phone screen
 * in a bleacher, not a desktop form.
 *
 * Requires middleware to treat "/contribute/" as a public page prefix and
 * "/api/contact-invite/" as a public API prefix.
 */

interface InviteInfo {
  invite: { role: "PLAYER" | "GUARDIAN" };
  player: { firstName: string };
  team: { organizationName: string; teamName: string };
  progress: {
    goalDollars: number;
    raisedDollars: number;
    percentRaised: number;
  };
  contacts: {
    minContactsPerPlayer: number;
    submitted: number;
    remaining: number;
    quotaMet: boolean;
  };
}

interface ContactRow {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: string;
}

interface SubmitResult {
  added: number;
  suppressedCount: number;
  duplicateCount: number;
  contacts: InviteInfo["contacts"];
}

const emptyRow = (): ContactRow => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  relationship: "",
});

const MAX_ROWS = 50;

export default function ContributePage() {
  const params = useParams();
  const token = params?.token as string;
  const { csrfToken } = useCsrfToken();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<InviteInfo | null>(null);

  const [rows, setRows] = useState<ContactRow[]>([emptyRow()]);
  // Last name is rarely needed to text grandma, so it stays folded away until
  // a parent asks for it. Tracked per row.
  const [showLastName, setShowLastName] = useState<Record<number, boolean>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    if (!token) return;

    async function load() {
      try {
        setLoading(true);
        setLoadError(null);

        const res = await fetch(`/api/contact-invite/${token}`, {
          method: "GET",
        });
        const data = await res.json();

        if (!res.ok) {
          setLoadError(data?.error || "This link is not valid.");
          return;
        }

        setInfo(data as InviteInfo);
      } catch {
        setLoadError("We couldn't load this link. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  const updateRow = (index: number, field: keyof ContactRow, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addRow = () => {
    setRows((prev) => (prev.length >= MAX_ROWS ? prev : [...prev, emptyRow()]));
  };

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  // A row counts as filled once it has an email or a phone - the same rule the
  // API enforces, so the submit-time validation matches what the server accepts.
  const filledRows = rows.filter((r) => r.email.trim() || r.phone.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (filledRows.length === 0) {
      setSubmitError("Add at least one supporter with an email or phone number.");
      return;
    }

    if (!consent) {
      setSubmitError(
        "Please confirm you have permission to share these contact details."
      );
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/contact-invite/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          consentAttested: true,
          contacts: filledRows.map((r) => ({
            firstName: r.firstName || undefined,
            lastName: r.lastName || undefined,
            email: r.email || undefined,
            phone: r.phone || undefined,
            relationship: r.relationship || undefined,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data?.error || "We couldn't save those supporters.");
        return;
      }

      setResult(data as SubmitResult);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Loading -------------------------------------------------------------
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-4">
        <div role="status" className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="sr-only">Loading this invitation…</span>
        </div>
      </main>
    );
  }

  // --- Dead / expired link -------------------------------------------------
  if (loadError || !info) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning-light">
              <AlertCircle className="h-6 w-6 text-warning" />
            </div>
            <CardTitle className="text-center text-xl">Link unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">{loadError}</p>
            <p className="text-center text-sm text-muted-foreground">
              These links expire, and each one only works for one player. Ask
              your coach or team leader for a new link and it will pick up right
              where this one left off.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Go to Bleacher Backers</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isGuardian = info.invite.role === "GUARDIAN";
  const quota = info.contacts.minContactsPerPlayer;

  // --- Success -------------------------------------------------------------
  if (result) {
    const after = result.contacts;
    return (
      <main className="min-h-screen bg-muted p-4">
        <div className="mx-auto w-full max-w-md pt-8">
          <Card>
            <CardHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
                <CheckCircle2 className="h-6 w-6 text-success-dark" />
              </div>
              <CardTitle className="text-center text-xl">
                Nice &mdash; {info.player.firstName} is closer.
              </CardTitle>
              <CardDescription className="text-center">
                We&apos;ll only message these people about this fundraiser, and
                every note has an unsubscribe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quota > 0 && (
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {after.submitted} of {quota} supporters added
                  </p>
                  {after.quotaMet ? (
                    <p className="mt-1 text-sm text-success-dark">
                      That&apos;s the list the coach asked for. Thank you.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {after.remaining} more to reach the team goal.
                    </p>
                  )}
                </div>
              )}

              {result.duplicateCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {result.duplicateCount}{" "}
                  {result.duplicateCount === 1 ? "person was" : "people were"}{" "}
                  already on the list, so we didn&apos;t add them twice.
                </p>
              )}

              {result.suppressedCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {result.suppressedCount}{" "}
                  {result.suppressedCount === 1 ? "person" : "people"} previously
                  asked not to be contacted, so we left them off. We honor those
                  requests.
                </p>
              )}

              {!after.quotaMet && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setResult(null);
                    setRows([emptyRow()]);
                    setConsent(false);
                    setInfo((prev) => (prev ? { ...prev, contacts: after } : prev));
                  }}
                >
                  Add more supporters
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // --- Form ----------------------------------------------------------------
  return (
    <main className="min-h-screen bg-muted px-4 pb-12 pt-6">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isGuardian
              ? `You're adding supporters on behalf of ${info.player.firstName}`
              : `Add supporters for ${info.player.firstName}`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {info.team.teamName} &middot; {info.team.organizationName}
          </p>
        </header>

        {quota > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">
                  {info.contacts.submitted} of {quota} supporters added
                </span>
                {info.contacts.quotaMet && (
                  <span className="text-xs font-medium text-success-dark">
                    Goal met
                  </span>
                )}
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.min(info.contacts.submitted, quota)}
                aria-valuemin={0}
                aria-valuemax={quota}
                aria-label="Supporters added toward the team goal"
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-accent"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      quota > 0 ? (info.contacts.submitted / quota) * 100 : 0,
                      100
                    )}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {rows.map((row, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Someone who loves {info.player.firstName}
                  </CardTitle>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-warning"
                      aria-label={`Remove supporter ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Add an email or a phone number &mdash; either one works.
                </p>

                <div className="space-y-1">
                  <Label htmlFor={`firstName-${index}`} className="text-xs">
                    Name
                  </Label>
                  <Input
                    id={`firstName-${index}`}
                    placeholder="Grandma Rosa"
                    value={row.firstName}
                    onChange={(e) => updateRow(index, "firstName", e.target.value)}
                    autoComplete="off"
                  />
                  {showLastName[index] ? (
                    <div className="space-y-1 pt-2">
                      <Label htmlFor={`lastName-${index}`} className="text-xs">
                        Last name{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id={`lastName-${index}`}
                        value={row.lastName}
                        onChange={(e) => updateRow(index, "lastName", e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setShowLastName((prev) => ({ ...prev, [index]: true }))
                      }
                      className="text-xs font-medium text-primary underline"
                    >
                      Add last name
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`email-${index}`} className="text-xs">
                    Email
                  </Label>
                  <Input
                    id={`email-${index}`}
                    type="email"
                    inputMode="email"
                    value={row.email}
                    onChange={(e) => updateRow(index, "email", e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`phone-${index}`} className="text-xs">
                    Phone
                  </Label>
                  <Input
                    id={`phone-${index}`}
                    type="tel"
                    inputMode="tel"
                    value={row.phone}
                    onChange={(e) => updateRow(index, "phone", e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`relationship-${index}`} className="text-xs">
                    Relationship{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id={`relationship-${index}`}
                    placeholder="Grandparent, neighbor, family friend"
                    value={row.relationship}
                    onChange={(e) =>
                      updateRow(index, "relationship", e.target.value)
                    }
                    autoComplete="off"
                  />
                </div>

              </CardContent>
            </Card>
          ))}

          {rows.length < MAX_ROWS && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addRow}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add another supporter
            </Button>
          )}

          <Card>
            <CardContent className="pt-6">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                />
                <span className="text-sm text-foreground">
                  I know these people personally and they are okay with me
                  sharing their contact information with {info.team.teamName}.
                  They&apos;ll hear from the team about this fundraiser and can
                  unsubscribe at any time.
                </span>
              </label>
            </CardContent>
          </Card>

          {submitError && (
            <Alert>
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                {submitError}
              </AlertDescription>
            </Alert>
          )}

          {/* Deliberately not disabled on an incomplete form: a dead button
              explains nothing. handleSubmit names the missing piece instead. */}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding&hellip;
              </>
            ) : (
              `Add ${filledRows.length || ""} ${
                filledRows.length === 1 ? "supporter" : "supporters"
              }`.replace(/\s+/g, " ")
            )}
          </Button>

          <p className="px-2 text-center text-xs text-muted-foreground">
            We only use these details to share this team&apos;s fundraiser. We
            don&apos;t sell contact information, and every message includes a way
            to opt out.
          </p>
        </form>
      </div>
    </main>
  );
}
