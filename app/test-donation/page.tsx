"use client";

import { useEffect, useState } from "react";
import { DonationForm } from "@/components/DonationForm";
import { Loader2 } from "lucide-react";

export default function TestDonationPage() {
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch a campaign to test with (public endpoint — no auth required)
    fetch("/api/campaigns/public?limit=1")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.campaigns && data.campaigns.length > 0) {
          setCampaign(data.campaigns[0]);
        } else {
          setError("No campaigns found. Please create a campaign first.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch campaign:", err);
        setError("Failed to load campaign");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center max-w-md bg-white rounded-lg shadow p-8">
          <p className="text-warning mb-4">{error || "Campaign not found"}</p>
          <a href="/create-campaign" className="text-primary hover:underline">
            Create a campaign
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Bleacher Backers</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Campaign Info */}
          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">{campaign.teamName}</h1>
              <p className="text-muted-foreground mb-4">{campaign.organizationName}</p>
              <p className="text-foreground mb-6">{campaign.description}</p>

              <div className="bg-muted rounded-lg p-4">
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">
                      ${(Number(campaign.currentAmount) / 100).toLocaleString()} of ${(Number(campaign.goalAmount) / 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-accent rounded-full h-3">
                    <div
                      className="bg-primary h-3 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (Number(campaign.currentAmount) / Number(campaign.goalAmount)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {Math.round((Number(campaign.currentAmount) / Number(campaign.goalAmount)) * 100)}% of goal reached
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Test Mode:</strong> This is a demo donation page. No real money will be charged.
                You can use any email address for testing.
              </p>
            </div>
          </div>

          {/* Donation Form */}
          <div>
            <DonationForm
              campaignId={campaign.id}
              campaignName={campaign.teamName}
              platformFeePercent={campaign.platformFeePercent}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
