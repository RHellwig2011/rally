"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Heart, CheckCircle2 } from "lucide-react";

interface DonationFormProps {
  campaignId: string;
  campaignName: string;
  platformFeePercent?: number;
}

const SUGGESTED_AMOUNTS = [25, 50, 100, 250, 500];

export function DonationForm({ campaignId, campaignName, platformFeePercent = 10 }: DonationFormProps) {
  const [amount, setAmount] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorMessage, setDonorMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const selectedAmount = showCustom ? parseFloat(customAmount) || 0 : parseFloat(amount) || 0;

  // Calculate fees for display
  const platformFee = selectedAmount * (platformFeePercent / 100);
  const processingFee = selectedAmount * 0.029 + 0.30;
  const totalFees = platformFee + processingFee;
  const netToCampaign = selectedAmount - totalFees;

  const handleAmountSelect = (value: number) => {
    setAmount(value.toString());
    setShowCustom(false);
    setCustomAmount("");
  };

  const handleCustomClick = () => {
    setShowCustom(true);
    setAmount("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedAmount <= 0) {
      setError("Please select or enter a donation amount");
      return;
    }

    if (!donorEmail) {
      setError("Email is required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          donorEmail,
          donorName: donorName || undefined,
          donorMessage: donorMessage || undefined,
          amount: selectedAmount,
          isAnonymous,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to process donation");
        return;
      }

      // Success!
      setSuccess(true);

      // Reset form after a delay
      setTimeout(() => {
        setAmount("");
        setCustomAmount("");
        setDonorName("");
        setDonorEmail("");
        setDonorMessage("");
        setIsAnonymous(false);
        setSuccess(false);
        setShowCustom(false);
      }, 5000);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Donation error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-success bg-success-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
            <p className="text-gray-700 mb-4">
              Your ${selectedAmount.toFixed(2)} donation to <strong>{campaignName}</strong> has been
              processed successfully.
            </p>
            <div className="bg-white rounded-lg p-4 text-sm text-left">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Donation Amount:</span>
                <span className="font-semibold">${selectedAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Platform Fee ({platformFeePercent}%):</span>
                <span className="text-gray-500">-${platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Processing Fee:</span>
                <span className="text-gray-500">-${processingFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">Net to Campaign:</span>
                <span className="font-bold text-success">${netToCampaign.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              A receipt has been sent to {donorEmail}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          Make a Donation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Select Amount</Label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {SUGGESTED_AMOUNTS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={amount === value.toString() && !showCustom ? "default" : "outline"}
                  onClick={() => handleAmountSelect(value)}
                  className="h-12"
                >
                  ${value}
                </Button>
              ))}
              <Button
                type="button"
                variant={showCustom ? "default" : "outline"}
                onClick={handleCustomClick}
                className="h-12"
              >
                Custom
              </Button>
            </div>

            {showCustom && (
              <div className="mt-3">
                <Label htmlFor="customAmount">Custom Amount</Label>
                <div className="flex items-center mt-2">
                  <span className="text-lg text-gray-600 mr-2">$</span>
                  <Input
                    id="customAmount"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="text-lg"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fee Breakdown */}
          {selectedAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <p className="font-semibold mb-2">Donation Breakdown:</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Your donation:</span>
                  <span className="font-semibold">${selectedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Platform fee ({platformFeePercent}%):</span>
                  <span>-${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Processing fee (~3%):</span>
                  <span>-${processingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="font-semibold">Goes to campaign:</span>
                  <span className="font-bold text-primary">${netToCampaign.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Donor Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="donorEmail">Email Address *</Label>
              <Input
                id="donorEmail"
                type="email"
                placeholder="your@email.com"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
                required
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">For donation receipt</p>
            </div>

            <div>
              <Label htmlFor="donorName">Your Name (Optional)</Label>
              <Input
                id="donorName"
                placeholder="John Doe"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="donorMessage">Message to Campaign (Optional)</Label>
              <Textarea
                id="donorMessage"
                placeholder="Write an encouraging message..."
                value={donorMessage}
                onChange={(e) => setDonorMessage(e.target.value)}
                className="mt-2 min-h-[80px]"
              />
            </div>

            <div className="flex items-center">
              <input
                id="anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <Label htmlFor="anonymous" className="ml-2 text-sm font-normal cursor-pointer">
                Make my donation anonymous
              </Label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || selectedAmount <= 0 || !donorEmail}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Heart className="w-5 h-5 mr-2" />
                Donate ${selectedAmount > 0 ? selectedAmount.toFixed(2) : "0.00"}
              </>
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            This is a simulated donation for MVP demo purposes.
            In production, you'll be redirected to a secure payment page.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
