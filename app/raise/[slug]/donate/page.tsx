"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import DonationForm from "@/components/DonationForm";

interface Campaign {
  id: string;
  slug: string;
  organizationName: string;
  teamName: string;
  goalAmount: number;
  currentAmount: number;
  platformFeePercent: number;
}

export default function DonatePage({ params }: { params: { slug: string } }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(true);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  // Fetch campaign data
  useEffect(() => {
    async function fetchCampaign() {
      try {
        setIsLoadingCampaign(true);
        const response = await fetch(`/api/campaigns/slug/${params.slug}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          setCampaignError(data.error || "Campaign not found");
          return;
        }

        // Convert string amounts to numbers if needed
        const campaignData: Campaign = {
          id: data.campaign.id,
          slug: data.campaign.slug,
          organizationName: data.campaign.organizationName,
          teamName: data.campaign.teamName,
          goalAmount: typeof data.campaign.goalAmount === 'string'
            ? parseInt(data.campaign.goalAmount)
            : data.campaign.goalAmount,
          currentAmount: typeof data.campaign.currentAmount === 'string'
            ? parseInt(data.campaign.currentAmount)
            : data.campaign.currentAmount,
          platformFeePercent: data.campaign.platformFeePercent || 10,
        };

        setCampaign(campaignData);
      } catch (err) {
        console.error("Failed to fetch campaign:", err);
        setCampaignError("Failed to load campaign");
      } finally {
        setIsLoadingCampaign(false);
      }
    }

    if (params.slug) {
      fetchCampaign();
    }
  }, [params.slug]);

  // Loading state
  if (isLoadingCampaign) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (campaignError || !campaign) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Campaign Not Found</h1>
          <p className="text-muted-foreground mb-4">{campaignError || "This campaign does not exist."}</p>
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={`/raise/${params?.slug}`} className="flex items-center space-x-2">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Campaign</span>
            </Link>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Bleacher Backers</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Campaign Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Support {campaign.organizationName} {campaign.teamName}
          </h1>
          <p className="text-muted-foreground">
            Your donation helps make their goals a reality
          </p>
        </div>

        <DonationForm
          campaignId={campaign.id}
          campaignName={`${campaign.organizationName} ${campaign.teamName}`}
          platformFeePercent={campaign.platformFeePercent}
        />

        <p className="text-xs text-center text-muted-foreground mt-6">
          By donating, you agree to our{" "}
          <Link href="/terms" className="underline">Terms</Link> &{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
