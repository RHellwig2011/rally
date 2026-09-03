"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Copy, Send, RefreshCw, Mail, MessageSquare, Video, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, calculatePercentage } from "@/lib/utils";
import { useCsrfToken } from "@/hooks/useCsrfToken";

interface Campaign {
  id: string;
  slug: string;
  organizationName: string;
  teamName: string;
  description: string;
  // Dollar values (the campaign API divides cents by 100 before responding)
  goalAmount: number;
  currentAmount: number;
}

const messageTypes = [
  { id: "email", label: "Email", icon: Mail, description: "Full email message with subject and body" },
  { id: "sms", label: "SMS", icon: MessageSquare, description: "Short text message for mass outreach" },
  { id: "social", label: "Social Post", icon: Share2, description: "Social media post for Facebook/Instagram" },
  { id: "video", label: "Video Script", icon: Video, description: "Script for a fundraising video" },
];

const tones = [
  { id: "friendly", label: "Friendly", description: "Casual and approachable" },
  { id: "enthusiastic", label: "Enthusiastic", description: "Energetic and exciting" },
  { id: "heartfelt", label: "Heartfelt", description: "Emotional and sincere" },
  { id: "professional", label: "Professional", description: "Formal and business-like" },
];

export default function MessagesPage() {
  const params = useParams();
  const campaignId = params?.campaignId as string;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState("email");
  const [selectedTone, setSelectedTone] = useState("friendly");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [copied, setCopied] = useState(false);
  const { csrfToken } = useCsrfToken();

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}`);
      const data = await response.json();

      if (data.success) {
        setCampaign(data.campaign);
      }
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateMessage = async () => {
    if (!campaign) return;

    setGenerating(true);
    setGeneratedMessage("");
    setSubject("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/generate-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          type: selectedType,
          tone: selectedTone,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (selectedType === "email" && data.message && typeof data.message === "object") {
          setSubject(data.message.subject || "");
          setGeneratedMessage(data.message.body || "");
        } else if (selectedType === "video") {
          setGeneratedMessage(data.script || "");
        } else {
          setGeneratedMessage(typeof data.message === "string" ? data.message : "");
        }
      } else {
        setGeneratedMessage("Failed to generate message. Please try again.");
      }
    } catch (error) {
      console.error("Failed to generate message:", error);
      setGeneratedMessage("Error generating message. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    const textToCopy = subject
      ? `Subject: ${subject}\n\n${generatedMessage}`
      : generatedMessage;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Campaign Not Found</h1>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // API returns dollars; formatCurrency expects cents
  const goalAmountCents = Math.round(Number(campaign.goalAmount) * 100);
  const currentAmountCents = Math.round(Number(campaign.currentAmount) * 100);
  const percentage = calculatePercentage(currentAmountCents, goalAmountCents);

  return (
    <div className="min-h-screen py-8">
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
                <Sparkles className="w-8 h-8 text-primary" />
                AI Message Generator
              </h1>
              <p className="text-muted-foreground">
                Create personalized fundraising messages with AI
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Settings Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Campaign Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Team</div>
                  <div className="font-semibold text-foreground">
                    {campaign.organizationName} {campaign.teamName}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Progress</div>
                  <div className="font-semibold text-foreground">
                    {formatCurrency(currentAmountCents)} of {formatCurrency(goalAmountCents)}
                  </div>
                  <div className="text-sm text-primary">{percentage}% funded</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Campaign URL</div>
                  <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    rally.com/{campaign.slug}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Message Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Message Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {messageTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                        selectedType === type.id
                          ? "border-primary bg-primary-50"
                          : "border-border hover:border-primary-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            selectedType === type.id
                              ? "bg-primary text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{type.label}</p>
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Tone Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Message Tone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tones.map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => setSelectedTone(tone.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedTone === tone.id
                        ? "border-primary bg-primary-50"
                        : "border-border hover:border-primary-200"
                    }`}
                  >
                    <p className="font-semibold text-foreground">{tone.label}</p>
                    <p className="text-xs text-muted-foreground">{tone.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={generateMessage}
              disabled={generating}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Message
                </>
              )}
            </Button>
          </div>

          {/* Generated Message Display */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Message</CardTitle>
                  {generatedMessage && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToClipboard}
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Send className="w-4 h-4 mr-2" />
                        Send Now
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!generatedMessage && !generating && (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      Ready to Generate Your Message
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto mb-6">
                      Select your message type and tone, then click "Generate Message" to create
                      a personalized fundraising message powered by AI.
                    </p>
                    <div className="bg-primary-50 rounded-lg p-4 max-w-md mx-auto">
                      <p className="text-sm text-foreground">
                        <strong>💡 Tip:</strong> Generate multiple versions with different tones
                        to see what resonates best with your audience!
                      </p>
                    </div>
                  </div>
                )}

                {generating && (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      Creating Your Message...
                    </h3>
                    <p className="text-muted-foreground">
                      Our AI is crafting the perfect message for your campaign
                    </p>
                  </div>
                )}

                {generatedMessage && !generating && (
                  <div className="space-y-4">
                    {subject && (
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-2 block">
                          Subject Line
                        </label>
                        <div className="bg-muted rounded-lg p-4 border-2 border-border">
                          <p className="font-semibold text-foreground">{subject}</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-semibold text-foreground mb-2 block">
                        Message Body
                      </label>
                      <Textarea
                        value={generatedMessage}
                        onChange={(e) => setGeneratedMessage(e.target.value)}
                        rows={selectedType === "sms" ? 6 : 15}
                        className="font-sans text-base"
                      />
                      <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                        <span>{generatedMessage.length} characters</span>
                        {selectedType === "sms" && (
                          <span
                            className={
                              generatedMessage.length > 160
                                ? "text-[#E8A33D] font-semibold"
                                : ""
                            }
                          >
                            {generatedMessage.length > 160
                              ? `⚠️ ${Math.ceil(generatedMessage.length / 160)} SMS messages`
                              : "✓ 1 SMS message"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-primary-50 rounded-lg p-4">
                      <p className="text-sm text-foreground">
                        <strong>💡 Pro Tip:</strong> Feel free to edit the message to add your
                        personal touch or specific details before sending!
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Examples */}
            {!generatedMessage && !generating && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">How to Use</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        1
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Choose Message Type</p>
                        <p className="text-sm text-muted-foreground">
                          Select email, SMS, social post, or video script based on how you'll reach supporters
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        2
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Select Tone</p>
                        <p className="text-sm text-muted-foreground">
                          Pick the tone that matches your relationship with your audience
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        3
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Generate & Customize</p>
                        <p className="text-sm text-muted-foreground">
                          Let AI create your message, then edit it to make it perfect
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        4
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Copy & Send</p>
                        <p className="text-sm text-muted-foreground">
                          Copy the message and paste it into your email or SMS tool
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
