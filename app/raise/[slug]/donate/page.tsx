"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, Check, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { calculateDonationFees } from "@/lib/banking";

interface DonationFormData {
  amount: number;
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  donorMessage: string;
  isAnonymous: boolean;
  coverFees: boolean;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardZip: string;
}

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
  const [step, setStep] = useState(1);

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

  const [formData, setFormData] = useState<DonationFormData>({
    amount: 0,
    donorName: "",
    donorEmail: "",
    donorPhone: "",
    donorMessage: "",
    isAnonymous: false,
    coverFees: false,
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    cardZip: "",
  });

  const updateFormData = (field: keyof DonationFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const setQuickAmount = (amount: number) => {
    updateFormData("amount", amount);
  };

  // Calculate fee breakdown
  const fees = calculateDonationFees(
    formData.amount * 100, // Convert to cents
    campaign?.platformFeePercent || 10
  );

  const totalAmount = formData.coverFees
    ? fees.grossAmount + fees.processingFee
    : fees.grossAmount;

  const handleSubmit = async () => {
    console.log("Processing donation:", formData, fees);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Move to confirmation step
    setStep(3);
  };

  // Loading state
  if (isLoadingCampaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading campaign...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (campaignError || !campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Campaign Not Found</h1>
          <p className="text-gray-600 mb-4">{campaignError || "This campaign does not exist."}</p>
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              <span className="text-2xl font-bold text-gray-900">Rally</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Campaign Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Support {campaign.organizationName} {campaign.teamName}
          </h1>
          <p className="text-gray-600">
            Your donation helps make their goals a reality
          </p>
        </div>

        {/* Step Indicator */}
        {step < 3 && (
          <div className="flex items-center justify-center mb-8">
            <div className={`flex items-center ${step >= 1 ? "text-primary" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-primary text-white" : "bg-gray-200"}`}>
                {step > 1 ? <Check className="w-5 h-5" /> : "1"}
              </div>
              <span className="ml-2 text-sm font-medium">Amount</span>
            </div>
            <div className={`w-16 h-1 mx-4 ${step >= 2 ? "bg-primary" : "bg-gray-200"}`} />
            <div className={`flex items-center ${step >= 2 ? "text-primary" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-primary text-white" : "bg-gray-200"}`}>
                {step > 2 ? <Check className="w-5 h-5" /> : "2"}
              </div>
              <span className="ml-2 text-sm font-medium">Payment</span>
            </div>
          </div>
        )}

        <Card>
          {/* Step 1: Amount Selection */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Choose your donation amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Quick Amount Buttons */}
                  <div>
                    <Label>Select an amount:</Label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <Button
                        variant={formData.amount === 25 ? "default" : "outline"}
                        onClick={() => setQuickAmount(25)}
                        className="h-16"
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold">$25</div>
                          <div className="text-xs opacity-75">Common</div>
                        </div>
                      </Button>
                      <Button
                        variant={formData.amount === 50 ? "default" : "outline"}
                        onClick={() => setQuickAmount(50)}
                        className="h-16"
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold">$50</div>
                          <div className="text-xs opacity-75">Average</div>
                        </div>
                      </Button>
                      <Button
                        variant={formData.amount === 100 ? "default" : "outline"}
                        onClick={() => setQuickAmount(100)}
                        className="h-16"
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold">$100</div>
                          <div className="text-xs opacity-75">Popular</div>
                        </div>
                      </Button>
                    </div>
                  </div>

                  {/* Custom Amount */}
                  <div>
                    <Label htmlFor="customAmount">Or enter custom amount:</Label>
                    <div className="flex items-center mt-2">
                      <span className="text-2xl text-gray-600 mr-2">$</span>
                      <Input
                        id="customAmount"
                        type="number"
                        placeholder="0"
                        value={formData.amount || ""}
                        onChange={(e) => updateFormData("amount", parseFloat(e.target.value) || 0)}
                        className="text-2xl h-16"
                      />
                    </div>
                  </div>

                  {/* Fee Breakdown */}
                  {formData.amount > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Amount Breakdown:
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Your donation:</span>
                          <span className="font-semibold">
                            {formatCurrency(Number(fees.grossAmount))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Platform fee (10%):</span>
                          <span className="text-gray-600">
                            {formatCurrency(Number(fees.platformFee))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Processing fee (~3%):</span>
                          <span className="text-gray-600">
                            {formatCurrency(Number(fees.processingFee))}
                          </span>
                        </div>
                        <div className="border-t pt-2 flex justify-between">
                          <span className="font-semibold text-gray-900">
                            To campaign:
                          </span>
                          <span className="font-bold text-success">
                            {formatCurrency(Number(fees.netAmount))}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.coverFees}
                            onChange={(e) => updateFormData("coverFees", e.target.checked)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">
                            Cover processing fees (
                            {formatCurrency(Number(fees.processingFee))}) so 100% goes to the team
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => setStep(2)}
                    disabled={formData.amount <= 0}
                    className="w-full"
                    size="lg"
                  >
                    Continue to Payment
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Payment Details */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Complete Your ${formData.amount} Donation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Donor Information */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Your Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="donorName">Name *</Label>
                        <Input
                          id="donorName"
                          placeholder="John Doe"
                          value={formData.donorName}
                          onChange={(e) => updateFormData("donorName", e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="donorEmail">Email *</Label>
                        <Input
                          id="donorEmail"
                          type="email"
                          placeholder="john@example.com"
                          value={formData.donorEmail}
                          onChange={(e) => updateFormData("donorEmail", e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="donorPhone">Phone (Optional)</Label>
                        <Input
                          id="donorPhone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={formData.donorPhone}
                          onChange={(e) => updateFormData("donorPhone", e.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Payment Method
                    </h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-blue-900 font-medium">
                          Demo Mode: Using simulated payment processor
                        </span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input
                          id="cardNumber"
                          placeholder="4242 4242 4242 4242"
                          value={formData.cardNumber}
                          onChange={(e) => updateFormData("cardNumber", e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                          <Label htmlFor="cardExpiry">Expiry</Label>
                          <Input
                            id="cardExpiry"
                            placeholder="MM/YY"
                            value={formData.cardExpiry}
                            onChange={(e) => updateFormData("cardExpiry", e.target.value)}
                            className="mt-2"
                          />
                        </div>
                        <div className="col-span-1">
                          <Label htmlFor="cardCvv">CVV</Label>
                          <Input
                            id="cardCvv"
                            placeholder="123"
                            value={formData.cardCvv}
                            onChange={(e) => updateFormData("cardCvv", e.target.value)}
                            className="mt-2"
                          />
                        </div>
                        <div className="col-span-1">
                          <Label htmlFor="cardZip">ZIP</Label>
                          <Input
                            id="cardZip"
                            placeholder="12345"
                            value={formData.cardZip}
                            onChange={(e) => updateFormData("cardZip", e.target.value)}
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <Label htmlFor="donorMessage">
                      Leave a message (Optional)
                    </Label>
                    <Textarea
                      id="donorMessage"
                      placeholder="Go team! You've got this!"
                      value={formData.donorMessage}
                      onChange={(e) => updateFormData("donorMessage", e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isAnonymous}
                        onChange={(e) => updateFormData("isAnonymous", e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">
                        Make my donation anonymous
                      </span>
                    </label>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!formData.donorName || !formData.donorEmail}
                      className="flex-1"
                      size="lg"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      Donate ${formData.amount}
                    </Button>
                  </div>

                  <p className="text-xs text-center text-gray-500">
                    By donating, you agree to our Terms & Privacy Policy
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <>
              <CardContent className="py-12">
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success-light">
                    <Check className="w-10 h-10 text-success" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      Thank You!
                    </h2>
                    <p className="text-lg text-gray-600">
                      Your ${formData.amount} donation to {campaign.organizationName}{" "}
                      {campaign.teamName} was successful!
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Receipt Summary
                    </h3>
                    <div className="space-y-2 text-sm text-left">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total charged:</span>
                        <span className="font-semibold">
                          {formatCurrency(Number(totalAmount))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">To campaign:</span>
                        <span className="font-semibold text-success">
                          {formatCurrency(Number(fees.netAmount))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Platform fee:</span>
                        <span className="text-gray-600">
                          {formatCurrency(Number(fees.platformFee))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Processing fee:</span>
                        <span className="text-gray-600">
                          {formatCurrency(Number(fees.processingFee))}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm text-success">
                        <Check className="w-4 h-4" />
                        <span>Tax-deductible receipt sent to {formData.donorEmail}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-gray-600 font-medium">Help spread the word:</p>
                    <div className="flex gap-3 justify-center">
                      <Button variant="outline" size="sm">
                        Share on Facebook
                      </Button>
                      <Button variant="outline" size="sm">
                        Share on Twitter
                      </Button>
                      <Button variant="outline" size="sm">
                        Copy Link
                      </Button>
                    </div>
                  </div>

                  <div className="pt-6 space-y-3">
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/raise/${params?.slug}`}>
                        Back to Campaign
                      </Link>
                    </Button>
                    <Button asChild className="w-full">
                      <Link href="/">
                        Explore Other Campaigns
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
