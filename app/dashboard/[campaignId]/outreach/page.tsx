"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Upload,
  Send,
  Users,
  Check,
  X,
  Download,
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
  goalAmount: string;
  currentAmount: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  selected: boolean;
}

export default function OutreachPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.campaignId as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageType, setMessageType] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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
      const response = await fetch(`/api/campaigns/${campaignId}/contacts`);
      const data = await response.json();

      if (data.success) {
        setContacts(
          data.contacts.map((c: any) => ({
            ...c,
            selected: true,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
      // Use mock data if API fails
      setContacts([
        {
          id: "1",
          name: "John Doe",
          email: "john@example.com",
          phone: "+1234567890",
          selected: true,
        },
        {
          id: "2",
          name: "Jane Smith",
          email: "jane@example.com",
          phone: "+1234567891",
          selected: true,
        },
      ]);
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
      alert("Please select at least one contact");
      return;
    }

    if (!message.trim()) {
      alert("Please enter a message");
      return;
    }

    setSending(true);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send-outreach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageType,
          subject: messageType === "email" ? subject : undefined,
          message,
          contacts: selectedContacts.map((c) => ({
            email: c.email,
            phone: c.phone,
            name: c.name,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSent(true);
        setTimeout(() => {
          router.push(`/dashboard/${campaignId}`);
        }, 2000);
      } else {
        alert(data.error || "Failed to send messages");
      }
    } catch (error) {
      console.error("Failed to send:", error);
      alert("Failed to send messages. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const importCSV = () => {
    // This would trigger a file upload dialog
    alert("CSV import feature coming soon! For now, add contacts manually.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Campaign Not Found</h1>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const selectedCount = contacts.filter((c) => c.selected).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Send className="w-8 h-8 text-primary" />
                Mass Outreach
              </h1>
              <p className="text-gray-600">
                Send emails or SMS messages to your contacts
              </p>
            </div>
          </div>
        </div>

        {sent && (
          <Card className="mb-8 border-success bg-success-light">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Messages Sent Successfully!</h3>
                  <p className="text-sm text-gray-700">
                    Your message was sent to {selectedCount} contacts. Redirecting...
                  </p>
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
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {contact.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
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

                  <div className="pt-4 border-t space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={importCSV}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Import CSV
                    </Button>
                    <Button variant="outline" size="sm" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Contact
                    </Button>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
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
                    <div className="text-sm text-gray-600">Raised</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(parseInt(campaign.currentAmount))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Goal</div>
                    <div className="text-xl font-semibold text-gray-700">
                      {formatCurrency(parseInt(campaign.goalAmount))}
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
                        : "border-gray-200 hover:border-primary-200"
                    }`}
                  >
                    <Mail
                      className={`w-6 h-6 mx-auto mb-2 ${
                        messageType === "email" ? "text-primary" : "text-gray-400"
                      }`}
                    />
                    <p className="font-semibold text-gray-900">Email</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Full message with subject
                    </p>
                  </button>

                  <button
                    onClick={() => setMessageType("sms")}
                    className={`flex-1 px-6 py-4 rounded-xl border-2 transition-all ${
                      messageType === "sms"
                        ? "border-primary bg-primary-50"
                        : "border-gray-200 hover:border-primary-200"
                    }`}
                  >
                    <MessageSquare
                      className={`w-6 h-6 mx-auto mb-2 ${
                        messageType === "sms" ? "text-primary" : "text-gray-400"
                      }`}
                    />
                    <p className="font-semibold text-gray-900">SMS</p>
                    <p className="text-xs text-gray-500 mt-1">
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
                      placeholder="Enter email subject..."
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
                        ? "Enter your email message..."
                        : "Enter your SMS message..."
                    }
                  />
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-gray-500">{message.length} characters</span>
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
                  <p className="text-sm text-gray-700">
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
                    <p className="font-semibold text-gray-900">Ready to send?</p>
                    <p className="text-sm text-gray-600">
                      This will send to {selectedCount} selected contact
                      {selectedCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={sending || selectedCount === 0 || sent}
                    size="lg"
                  >
                    {sending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Sending...
                      </>
                    ) : sent ? (
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

                {messageType === "sms" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-gray-700">
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
