"use client";

import { useState } from "react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Heart, CheckCircle2, Share2 } from "lucide-react";
import { useCsrfToken } from "@/hooks/useCsrfToken";

const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

// Only surface the test-card hint on a test-mode key; on a live key it would
// read as an invitation to try a card that will be declined.
const IS_STRIPE_TEST_MODE = STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_");

// No key configured means Stripe.js can never load. Resolve that up front so
// the wrapper can explain itself instead of rendering a form that can't submit.
const stripePromise = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null;

interface DonationFormProps {
  campaignId: string;
  campaignName: string;
  teamMemberId?: string;
  platformFeePercent?: number;
  /** Campaign slug, used for the "back to campaign" link after a gift. */
  campaignSlug?: string;
  /** Player the gift is credited to, named on the thank-you screen. */
  playerName?: string;
  /** Preselected amount in dollars, e.g. from a ?amount=25 quick link. */
  initialAmount?: number;
}

const SUGGESTED_AMOUNTS = [25, 50, 100, 250, 500];

function DonationFormInner({
  campaignId,
  campaignName,
  teamMemberId,
  platformFeePercent = 10,
  campaignSlug,
  playerName,
  initialAmount,
}: DonationFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { csrfToken, loading: csrfLoading } = useCsrfToken();

  // A quick link carrying a suggested amount preselects that chip; anything
  // off the preset list drops into the custom field instead.
  const presetInitial =
    initialAmount && SUGGESTED_AMOUNTS.includes(initialAmount)
      ? initialAmount
      : null;
  const customInitial = initialAmount && !presetInitial ? initialAmount : null;

  const [amount, setAmount] = useState<string>(
    presetInitial ? presetInitial.toString() : ""
  );
  const [customAmount, setCustomAmount] = useState<string>(
    customInitial ? customInitial.toString() : ""
  );
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorMessage, setDonorMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [coverFees, setCoverFees] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCustom, setShowCustom] = useState(Boolean(customInitial));
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const selectedAmount = showCustom ? parseFloat(customAmount) || 0 : parseFloat(amount) || 0;

  // Fee breakdown for display (mirrors the server calculation)
  const platformFee = selectedAmount * (platformFeePercent / 100);
  const processingFee = selectedAmount > 0 ? selectedAmount * 0.029 + 0.3 : 0;
  // Covering fees means the donor pays the processing fee on top, so the
  // campaign only loses the platform fee.
  const totalCharged = coverFees ? selectedAmount + processingFee : selectedAmount;
  const netToCampaign = Math.max(
    0,
    coverFees
      ? selectedAmount - platformFee
      : selectedAmount - platformFee - processingFee
  );

  // Share the page the donor just gave through — the player's page when the
  // gift was credited to one, otherwise the team page.
  const handleShare = async () => {
    if (typeof window === "undefined" || !campaignSlug) return;
    const path = teamMemberId
      ? `/raise/${campaignSlug}/player/${teamMemberId}`
      : `/raise/${campaignSlug}`;
    const url = `${window.location.origin}${path}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: campaignName, url });
        return;
      } catch (err) {
        // A cancelled share sheet is not a failure worth reporting.
        if ((err as Error)?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareNotice("Link copied — paste it in a text to someone else who'd chip in");
    } catch {
      setShareNotice("We couldn't copy the link — you can copy it from the address bar");
    }
    setTimeout(() => setShareNotice(null), 4000);
  };

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

    if (selectedAmount < 1) {
      setError("Minimum donation is $1");
      return;
    }
    if (!donorEmail) {
      setError("Email is required");
      return;
    }
    if (!stripe || !elements) {
      setError("Payment form is still loading. Please try again in a moment.");
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create the donation + Stripe PaymentIntent
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          campaignId,
          teamMemberId,
          donorEmail,
          donorName: donorName || undefined,
          message: donorMessage || undefined,
          amount: selectedAmount,
          isAnonymous,
          coverFees,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to process donation");
        return;
      }

      const { clientSecret, donation } = data;

      // Step 2: Confirm the card payment with Stripe
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError("Card details are missing. Please re-enter your card.");
        return;
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: donorName || undefined,
              email: donorEmail,
            },
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message || "Your card could not be charged.");
        return;
      }

      // Step 3: Confirm completion on the backend
      const verifyResponse = await fetch(`/api/donations/${donation.id}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ paymentIntentId: paymentIntent?.id }),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok || !verifyData.success) {
        setError(verifyData.error || "We could not confirm your payment.");
        return;
      }

      setSuccess(true);
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
            <h3 className="text-2xl font-bold text-foreground mb-2">
              You&apos;re on the team now — thank you!
            </h3>
            <p className="text-foreground mb-2">
              We charged ${totalCharged.toFixed(2)}. A receipt is on its way to{" "}
              <strong>{donorEmail}</strong>. <strong>{campaignName}</strong> keeps $
              {netToCampaign.toFixed(2)}.
            </p>
            {playerName && (
              <p className="text-foreground mb-2">
                Your gift is credited to <strong>{playerName}</strong>.
              </p>
            )}

            {/* The fee math is here for anyone who wants it, but it is not the
                first thing a donor should read after paying. */}
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                See the breakdown
              </summary>
              <div className="bg-white rounded-lg p-4 mt-2 text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Your gift:</span>
                  <span className="font-semibold">${selectedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">
                    Card processing{coverFees ? " (covered by you)" : ""}:
                  </span>
                  <span className="text-muted-foreground">
                    {coverFees ? "+" : "-"}${processingFee.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">
                    Bleacher Backers keeps ({platformFeePercent}%):
                  </span>
                  <span className="text-muted-foreground">-${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Charged to your card:</span>
                  <span className="font-semibold">${totalCharged.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">The team receives:</span>
                  <span className="font-bold text-success">${netToCampaign.toFixed(2)}</span>
                </div>
              </div>
            </details>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-center">
              {campaignSlug && (
                <Button onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share this fundraiser
                </Button>
              )}
              {campaignSlug && (
                <Button variant="outline" asChild>
                  <Link href={`/raise/${campaignSlug}`}>Leave a cheer</Link>
                </Button>
              )}
            </div>
            {shareNotice && (
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                {shareNotice}
              </p>
            )}
            {campaignSlug && (
              <p className="mt-4 text-sm">
                <Link
                  href={`/raise/${campaignSlug}`}
                  className="text-muted-foreground underline"
                >
                  Back to campaign
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-warning" />
          Back this team
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Select Amount</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
              {SUGGESTED_AMOUNTS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={amount === value.toString() && !showCustom ? "default" : "outline"}
                  aria-pressed={amount === value.toString() && !showCustom}
                  onClick={() => handleAmountSelect(value)}
                  className="h-12 text-base font-semibold"
                >
                  ${value}
                </Button>
              ))}
              <Button
                type="button"
                variant={showCustom ? "default" : "outline"}
                aria-pressed={showCustom}
                onClick={handleCustomClick}
                className="h-12 text-base font-semibold"
              >
                Custom
              </Button>
            </div>

            {showCustom && (
              <div className="mt-3">
                <Label htmlFor="customAmount">Custom Amount</Label>
                <div className="flex items-center mt-2">
                  <span className="text-lg text-muted-foreground mr-2">$</span>
                  <Input
                    id="customAmount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="1"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="text-lg h-12"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fee Breakdown */}
          {selectedAmount > 0 && (
            <div className="bg-muted rounded-lg p-4 text-sm">
              <p className="font-semibold mb-2">Where your gift goes:</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your gift:</span>
                  <span className="font-semibold">${selectedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Bleacher Backers keeps ({platformFeePercent}%):</span>
                  <span>-${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Card processing:</span>
                  <span>{coverFees ? `+$${processingFee.toFixed(2)}` : `-$${processingFee.toFixed(2)}`}</span>
                </div>
                {coverFees && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total charged to you:</span>
                    <span className="font-semibold">${totalCharged.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-semibold">Goes to the team:</span>
                  <span className="font-bold text-primary">${netToCampaign.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={coverFees}
                    onChange={(e) => setCoverFees(e.target.checked)}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary cursor-pointer"
                  />
                  <span className="text-foreground">
                    Add ${processingFee.toFixed(2)} so the team isn&apos;t charged the card fee
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Donor Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="donorEmail">Email for your receipt *</Label>
              <Input
                id="donorEmail"
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
                required
                className="mt-2 h-12"
              />
              <p className="text-xs text-muted-foreground mt-1">
                We&apos;ll send a receipt. We won&apos;t add you to a mailing list.
              </p>
            </div>

            <div>
              <Label htmlFor="donorName">Your Name (Optional)</Label>
              <Input
                id="donorName"
                type="text"
                autoComplete="name"
                placeholder="How should we list you? (e.g. The Martinez family)"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="mt-2 h-12"
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
                maxLength={500}
              />
            </div>

            <div className="flex items-center">
              <input
                id="anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-5 h-5 text-primary border-border rounded focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="anonymous" className="ml-3 text-base font-normal cursor-pointer">
                Make my donation anonymous
              </Label>
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <Label className="mb-2 block">Payment Details</Label>
            <div className="p-4 border rounded-md min-h-[48px] flex items-center">
              <div className="w-full">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: "16px",
                        color: "#424770",
                        "::placeholder": { color: "#aab7c4" },
                      },
                      invalid: { color: "#ef4444", iconColor: "#ef4444" },
                    },
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Paid securely through Stripe. We never see or store your card.
            </p>
            {IS_STRIPE_TEST_MODE && (
              <p className="text-xs text-muted-foreground mt-1">
                Test mode: use card 4242 4242 4242 4242, any future date, any CVC.
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="bg-warning-light border border-warning rounded-lg p-3 text-sm text-warning-dark"
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={
              isLoading ||
              csrfLoading ||
              !stripe ||
              selectedAmount < 1 ||
              !donorEmail
            }
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
                Donate ${totalCharged > 0 ? totalCharged.toFixed(2) : "0.00"}
              </>
            )}
          </Button>

        </form>
      </CardContent>
    </Card>
  );
}

export function DonationForm(props: DonationFormProps) {
  if (!stripePromise) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="font-semibold text-foreground mb-1">
            Donations are temporarily unavailable
          </p>
          <p className="text-sm text-muted-foreground">
            Online giving isn&apos;t switched on right now. Please check back
            shortly, or reach out to the team directly to contribute.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <DonationFormInner {...props} />
    </Elements>
  );
}

export default DonationForm;
