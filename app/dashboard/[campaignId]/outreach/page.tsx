"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useCsrfToken } from "@/hooks/useCsrfToken";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Send,
  Users,
  Check,
  X,
  Sparkles,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

interface Campaign {
  id: string;
  slug: string;
  organizationName: string;
  teamName: string;
  // Dollar values (the campaign API divides cents by 100 before responding)
  goalAmount: number;
  currentAmount: number;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  selected: boolean;
}

interface OutreachResultRow {
  recipient: string | null;
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string;
}

/**
 * The send endpoint returns HTTP 200 with success:true for any run that passes
 * validation — including runs that delivered nothing. The real outcome lives
 * in these counters, so the UI must read them rather than trusting `success`.
 */
interface SendOutreachResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  results: OutreachResultRow[];
  message?: string;
}

// Matches the contacts endpoint's own page size and its per-request cap.
const CONTACTS_PAGE_SIZE = 500;
// Backstop so a runaway pagination response cannot spin this loop forever.
const CONTACTS_MAX_FETCH = 10_000;

export default function OutreachPage() {
  const params = useParams();
  const { csrfToken } = useCsrfToken();
  const campaignId = params?.campaignId as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageType, setMessageType] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendOutreachResult | null>(null);

  useEffect(() => {
    fetchCampaign();
    fetchContacts();
  }, [campaignId]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}`);
      const data = await response.json();

      if (data.success) {
        setCampaign(data.campaign);
        // Set default message
        setSubject(`Support ${data.campaign.teamName}!`);
        setMessage(
          `Hi there!\n\nWe're raising money for ${data.campaign.organizationName} ${data.campaign.teamName}. Every donation helps us reach our goal!\n\nSupport us at: rally.com/${data.campaign.slug}\n\nThank you for your support!`
        );
      }
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      setContactsError(null);

      // The contacts endpoint is paginated (500 per page), so page through it
      // until hasMore is false. Fetching once would silently drop contacts 501+
      // from the recipient picker — a coach with a large roster would send to a
      // truncated list with nothing on screen saying so.
      const collected: any[] = [];
      let offset = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const response = await fetch(
          `/api/campaigns/${campaignId}/contacts?limit=${CONTACTS_PAGE_SIZE}&offset=${offset}`
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          setContacts([]);
          setContactsError(
            response.status === 401
              ? "Your session has expired. Please sign in again to load contacts."
              : data.error || "Could not load contacts. Please try again."
          );
          return;
        }

        const page: any[] = data.contacts || [];
        collected.push(...page);

        if (!data.pagination?.hasMore || page.length === 0) {
          break;
        }
        offset += page.length;

        if (collected.length >= CONTACTS_MAX_FETCH) {
          console.warn(
            `Stopped loading contacts at ${collected.length}; the campaign has more than the picker will show.`
          );
          break;
        }
      }

      setContacts(
        collected.map((c: any) => ({
          ...c,
          selected: true,
        }))
      );
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
      // Never fall back to placeholder people — sending outreach to fabricated
      // contacts is worse than showing the coach an error.
      setContacts([]);
      setContactsError("Could not load contacts. Please try again.");
    }
  };

  const toggleContact = (id: string) => {
    setContacts(
      contacts.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const selectAll = () => {
    setContacts(contacts.map((c) => ({ ...c, selected: true })));
  };

  const deselectAll = () => {
    setContacts(contacts.map((c) => ({ ...c, selected: false })));
  };

  const handleSend = async () => {
    const selectedContacts = contacts.filter((c) => c.selected);

    if (selectedContacts.length === 0) {
      setSendError("Pick at least one person to send to.");
      return;
    }

    if (!message.trim()) {
      setSendError("Write a short message first.");
      return;
    }

    setSendError(null);
    setSending(true);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send-outreach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          messageType,
          subject: messageType === "email" ? subject : undefined,
          message,
          // Strip null/empty fields — the API schema expects absent, not null
          contacts: selectedContacts.map((c) => ({
            email: c.email || undefined,
            phone: c.phone || undefined,
            name: c.name || undefined,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setSendError(data.error || "Failed to send messages");
        return;
      }

      // success:true only means the request was accepted. Trust the counters.
      const result: SendOutreachResult = {
        attempted: data.attempted ?? selectedContacts.length,
        sent: data.sent ?? 0,
        failed: data.failed ?? 0,
        skipped: data.skipped ?? 0,
        results: Array.isArray(data.results) ? data.results : [],
        message: data.message,
      };

      // The coach stays put after a send. Yanking them to the dashboard two
      // seconds later hides the result they just asked for.
      setSendResult(result);
    } catch (error) {
      console.error("Failed to send:", error);
      setSendError("Failed to send messages. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Campaign Not Found</h1>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const selectedCount = contacts.filter((c) => c.selected).length;

  // A run is "clean" only when something was sent and nothing failed or was
  // withheld. Everything else must stay on screen with the detail attached.
  const cleanRun =
    sendResult !== null &&
    sendResult.sent > 0 &&
    sendResult.failed === 0 &&
    sendResult.skipped === 0;
  const totalFailure =
    sendResult !== null && sendResult.sent === 0 && sendResult.attempted > 0;
  const problemRows =
    sendResult?.results.filter((r) => r.status !== "SENT") ?? [];

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={`/dashboard/${campaignId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
                <Send className="w-8 h-8 text-primary" />
                Ask families for support
              </h1>
              <p className="text-muted-foreground">
                Send one email or text. People can unsubscribe any time.
              </p>
            </div>
          </div>
        </div>

        {sendResult && cleanRun && (
          <Card className="mb-8 border-success bg-success-light">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">
                    Sent to {sendResult.sent}{" "}
                    {sendResult.sent === 1 ? "person" : "people"}.
                  </h3>
                  <p className="text-sm text-foreground">
                    Want to send a thank-you later? You&apos;re done for now.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {sendResult && totalFailure && (
          <Card className="mb-8 border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-destructive rounded-full flex items-center justify-center flex-shrink-0">
                  <X className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground">No Messages Were Delivered</h3>
                  <p className="text-sm text-foreground">
                    {sendResult.message ||
                      `0 of ${sendResult.attempted} message${
                        sendResult.attempted !== 1 ? "s" : ""
                      } went out.`}
                  </p>
                  {problemRows.length > 0 && (
                    <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                      {problemRows.map((row, i) => (
                        <li key={i} className="text-sm text-foreground">
                          <span className="font-medium">
                            {row.recipient || "Unknown recipient"}
                          </span>
                          {": "}
                          <span className="text-muted-foreground">
                            {row.error ||
                              (row.status === "SKIPPED"
                                ? "Skipped"
                                : "Delivery failed")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {sendResult && !cleanRun && !totalFailure && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground">Partially Sent</h3>
                  <p className="text-sm text-foreground">
                    {sendResult.message ||
                      `Sent ${sendResult.sent} of ${sendResult.attempted}.`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sendResult.sent} sent
                    {sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ""}
                    {sendResult.skipped > 0
                      ? `, ${sendResult.skipped} skipped (opted out or missing contact details)`
                      : ""}
                    .
                  </p>
                  {problemRows.length > 0 && (
                    <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                      {problemRows.map((row, i) => (
                        <li key={i} className="text-sm text-foreground">
                          <span className="font-medium">
                            {row.recipient || "Unknown recipient"}
                          </span>
                          {": "}
                          <span className="text-muted-foreground">
                            {row.error ||
                              (row.status === "SKIPPED"
                                ? "Skipped"
                                : "Delivery failed")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Contacts */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Contacts ({selectedCount}/{contacts.length})
                  </CardTitle>
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {contactsError && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
                      <p className="text-sm text-destructive">{contactsError}</p>
                      <button
                        onClick={fetchContacts}
                        className="mt-1 text-sm font-medium text-destructive underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAll}
                      className="flex-1"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deselectAll}
                      className="flex-1"
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => toggleContact(contact.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-all ${
                          contact.selected
                            ? "border-primary bg-primary-50"
                            : "border-border hover:border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">
                              {contact.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {messageType === "email" ? contact.email : contact.phone}
                            </p>
                          </div>
                          {contact.selected && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Import CSV / Add Contact / Download Template were stubs.
                      Contacts come from the roster, so point there instead. */}
                  <div className="pt-4 border-t">
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href={`/dashboard/${campaignId}/roster`}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add people on the roster
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaign Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Raised</div>
                    <div className="text-2xl font-bold text-foreground">
                      {/* API returns dollars; formatCurrency expects cents */}
                      {formatCurrency(Math.round(Number(campaign.currentAmount) * 100))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Goal</div>
                    <div className="text-xl font-semibold text-foreground">
                      {formatCurrency(Math.round(Number(campaign.goalAmount) * 100))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right - Message Composer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Message Type Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Message Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <button
                    onClick={() => setMessageType("email")}
                    className={`flex-1 px-6 py-4 rounded-xl border-2 transition-all ${
                      messageType === "email"
                        ? "border-primary bg-primary-50"
                        : "border-border hover:border-primary-200"
                    }`}
                  >
                    <Mail
                      className={`w-6 h-6 mx-auto mb-2 ${
                        messageType === "email" ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <p className="font-semibold text-foreground">Email</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Full message with subject
                    </p>
                  </button>

                  <button
                    onClick={() => setMessageType("sms")}
                    className={`flex-1 px-6 py-4 rounded-xl border-2 transition-all ${
                      messageType === "sms"
                        ? "border-primary bg-primary-50"
                        : "border-border hover:border-primary-200"
                    }`}
                  >
                    <MessageSquare
                      className={`w-6 h-6 mx-auto mb-2 ${
                        messageType === "sms" ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <p className="font-semibold text-foreground">SMS</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Short text message
                    </p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Message Composer */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Compose Message</CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/${campaignId}/messages`}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Use AI Generator
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {messageType === "email" && (
                  <div>
                    <Label htmlFor="subject" className="mb-2">
                      Subject Line
                    </Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder={`Help the ${campaign.teamName} get to regionals`}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="message" className="mb-2">
                    Message {messageType === "sms" && "(Keep under 160 characters)"}
                  </Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={messageType === "email" ? 12 : 6}
                    placeholder={
                      messageType === "email"
                        ? `Hi {name},\n\nOur ${campaign.teamName} are raising money for the season. Any amount helps, and every gift goes straight to the team. Thank you!`
                        : `Hi {name} — our ${campaign.teamName} are fundraising this season. Any amount helps!`
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Type <code>{"{name}"}</code> anywhere and we&apos;ll swap in each
                    person&apos;s name when the message goes out.
                  </p>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-muted-foreground">{message.length} characters</span>
                    {messageType === "sms" && (
                      <span
                        className={
                          message.length > 160
                            ? "text-orange-600 font-semibold"
                            : "text-success"
                        }
                      >
                        {message.length > 160
                          ? `⚠️ ${Math.ceil(message.length / 160)} SMS messages`
                          : "✓ 1 SMS message"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-primary-50 rounded-lg p-4">
                  <p className="text-sm text-foreground">
                    <strong>💡 Pro Tip:</strong> Personalize your message by mentioning
                    specific details about your team's goals and why their support matters!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Send Button */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-foreground">Ready to send?</p>
                    <p className="text-sm text-muted-foreground">
                      This will send to {selectedCount} selected contact
                      {selectedCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={sending || selectedCount === 0 || cleanRun}
                    size="lg"
                  >
                    {sending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Sending...
                      </>
                    ) : cleanRun ? (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        Sent!
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Send {messageType === "email" ? "Emails" : "SMS"}
                      </>
                    )}
                  </Button>
                </div>

                {sendError && (
                  <div
                    role="alert"
                    className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {sendError}
                  </div>
                )}

                {messageType === "sms" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-foreground">
                      <strong>Note:</strong> SMS messages are charged per message sent.
                      Messages over 160 characters count as multiple messages.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
