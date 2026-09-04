"use client";

import { Suspense, useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="text-center">
        <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading campaign...</p>
      </div>
    </div>
  );
}

function DonatePageContent({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(true);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  // Quick-amount links from the campaign page arrive as ?amount=25.
  const amountParam = searchParams?.get("amount");
  const parsedAmount = amountParam ? parseFloat(amountParam) : NaN;
  const initialAmount =
    Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined;

  // Fetch campaign data
  const fetchCampaign = useCallback(async () => {
    try {
      setIsLoadingCampaign(true);
      setCampaignError(null);
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
  }, [params.slug]);

  useEffect(() => {
    if (params.slug) {
      fetchCampaign();
    }
  }, [params.slug, fetchCampaign]);

  // Loading state
  if (isLoadingCampaign) {
    return <LoadingScreen />;
  }

  // Error state
  if (campaignError || !campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="text-center">
          <h1 className="mb-2 font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-foreground">
            Campaign not found
          </h1>
          <p className="mb-5 text-sm text-muted-foreground">{campaignError || "This campaign does not exist."}</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={fetchCampaign}>
              Try again
            </Button>
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Site header — BRIEF §3, the same chrome as the campaign page. */}
      <nav className="sticky top-0 z-50 border-b border-border bg-[rgba(10,13,20,.86)] backdrop-blur-[10px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link
              href={`/raise/${params?.slug}`}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="font-medium">Back to campaign</span>
            </Link>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-[9px] w-[9px] flex-shrink-0 rounded-full bg-primary shadow-glow-team"
              />
              <span className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-foreground">
                Bleacher Backers
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Campaign Header */}
        <div className="mb-8 text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300 sm:text-[12px]"
            style={{ textShadow: "0 0 14px rgba(200,16,46,.6)" }}
          >
            {campaign.organizationName}
          </p>
          <h1
            className="mt-3 font-display text-[clamp(30px,6vw,46px)] font-extrabold uppercase leading-[0.96] tracking-[-0.03em] text-foreground"
            style={{
              textShadow:
                "0 2px 0 rgba(200,16,46,.5), 0 6px 0 rgba(200,16,46,.2), 0 18px 44px rgba(200,16,46,.25)",
            }}
          >
            Back the {campaign.teamName}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Every fee is itemized before you give, never after.
          </p>
        </div>

        <DonationForm
          campaignId={campaign.id}
          campaignName={`${campaign.organizationName} ${campaign.teamName}`}
          campaignSlug={campaign.slug || params.slug}
          platformFeePercent={campaign.platformFeePercent}
          initialAmount={initialAmount}
        />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By donating, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 transition-colors hover:text-foreground">
            Terms
          </Link>{" "}
          &amp;{" "}
          <Link href="/privacy" className="underline underline-offset-4 transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function DonatePage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DonatePageContent params={params} />
    </Suspense>
  );
}
