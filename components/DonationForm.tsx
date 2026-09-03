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
import { Card, CardContent } from "@/components/ui/card";
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

  // Display only: the same formula as netToCampaign, evaluated for a suggested
  // chip so each tile can print what that gift actually delivers. Nothing here
  // feeds the request body — the server recomputes every fee.
  const reachFor = (value: number) => {
    const fee = value * (platformFeePercent / 100);
    const processing = value * 0.029 + 0.3;
    return Math.max(0, coverFees ? value - fee : value - fee - processing);
  };

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

  // ---------------------------------------------------------------- Success
  // BRIEF §4 screen 04 "confirmation": success hero with the amount set large
  // in red, then the honest-fee receipt rows and a share CTA.
  if (success) {
    return (
      <Card>
        <CardContent className="pt-8">
          <div className="text-center">
            <span
              className="mx-auto mb-5 flex h-[46px] w-[46px] animate-fade-in items-center justify-center rounded-full bg-secondary shadow-[0_0_34px_rgba(34,196,139,.55)]"
              aria-hidden
            >
              <CheckCircle2 className="h-6 w-6 text-[#06231A]" />
            </span>
            <h3
              className="font-display text-[clamp(26px,7vw,40px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-foreground"
              style={{
                textShadow:
                  "0 2px 0 rgba(200,16,46,.55), 0 6px 0 rgba(200,16,46,.22), 0 18px 44px rgba(200,16,46,.28)",
              }}
            >
              You gave
              <span
                className="mt-1 block text-[clamp(38px,10vw,56px)] tabular text-primary"
                style={{
                  textShadow:
                    "0 2px 0 rgba(255,255,255,.14), 0 10px 44px rgba(200,16,46,.6)",
                }}
              >
                ${totalCharged.toFixed(2)}
              </span>
            </h3>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A receipt is on its way to{" "}
              <span className="font-semibold text-foreground">{donorEmail}</span>.
            </p>
            {playerName && (
              <p className="mt-1 text-sm text-muted-foreground">
                Your gift is credited to{" "}
                <span className="font-semibold text-foreground">{playerName}</span>.
              </p>
            )}

            {/* Honest-fee receipt. Not the first thing a donor should read after
                paying, but never hidden either. */}
            <div className="mt-7 rounded-[14px] border border-white/10 bg-[rgba(13,17,25,.92)] p-5 text-left">
              <h4 className="mb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                The receipt
              </h4>
              <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-sm text-muted-foreground">
                <span>Your gift</span>
                <span className="tabular text-foreground">${selectedAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-sm text-muted-foreground">
                <span>Card processing{coverFees ? " (covered by you)" : ""}</span>
                <span className="tabular text-foreground">
                  {coverFees ? "+" : "−"}${processingFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-sm text-muted-foreground">
                <span>Bleacher Backers keeps ({platformFeePercent}%)</span>
                <span className="tabular text-foreground">−${platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-sm text-muted-foreground">
                <span>Charged to your card</span>
                <span className="tabular text-foreground">${totalCharged.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 text-base font-semibold text-foreground">
                <span>{campaignName} receives</span>
                <span
                  className="font-bold tabular text-[#3ECF9C]"
                  style={{ textShadow: "0 0 18px rgba(62,207,156,.45)" }}
                >
                  ${netToCampaign.toFixed(2)}
                </span>
              </div>
            </div>

            {campaignSlug && (
              <>
                <Button
                  onClick={handleShare}
                  className="mt-6 h-14 w-full font-display text-base font-bold uppercase tracking-[0.02em]"
                >
                  <Share2 className="mr-2 h-5 w-5" />
                  Share this fundraiser
                </Button>
                <Button variant="outline" className="mt-3 w-full" asChild>
                  <Link href={`/raise/${campaignSlug}`}>Leave a cheer</Link>
                </Button>
              </>
            )}
            {shareNotice && (
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                {shareNotice}
              </p>
            )}
            {campaignSlug && (
              <p className="mt-5 text-sm">
                <Link
                  href={`/raise/${campaignSlug}`}
                  className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
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
      <CardContent className="pt-8">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* ------------------------------------------------- Step 01: amount */}
          {/* BRIEF §4 screen 03: numbered steps with a red outlined numeral. */}
          <section>
            <div className="mb-4 flex items-baseline gap-3">
              <span
                aria-hidden
                className="font-display text-[30px] font-extrabold leading-none text-transparent"
                style={{ WebkitTextStroke: "1.5px #C8102E" }}
              >
                01
              </span>
              <h3 className="font-display text-[20px] font-extrabold uppercase tracking-[-0.01em] text-foreground">
                Pick an amount
              </h3>
            </div>

            {/* Gradient chip tiles. Selected flips to a red border + red glow. */}
            <div className="grid grid-cols-2 gap-3">
              {SUGGESTED_AMOUNTS.map((value) => {
                const isSelected = amount === value.toString() && !showCustom;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleAmountSelect(value)}
                    className="min-h-[44px] rounded-[14px] border border-white/10 bg-[linear-gradient(160deg,#181E2A,#12161F)] p-4 text-left transition-[transform,border-color,box-shadow] duration-200 ease-spring hover:-translate-y-0.5 hover:border-[#3A4356] hover:shadow-[0_12px_30px_rgba(0,0,0,.4)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/55 active:scale-[.98] aria-pressed:border-primary aria-pressed:shadow-[0_0_0_1px_#C8102E,0_10px_34px_rgba(200,16,46,.35),inset_0_0_22px_rgba(200,16,46,.12)]"
                  >
                    <span className="block font-display text-[26px] font-extrabold tabular leading-none text-foreground">
                      ${value}
                    </span>
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      <span className="font-semibold tabular text-[#3ECF9C]">
                        ${reachFor(value).toFixed(2)}
                      </span>{" "}
                      reaches the team
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={showCustom}
                onClick={handleCustomClick}
                className="min-h-[44px] rounded-[14px] border border-white/10 bg-[linear-gradient(160deg,#181E2A,#12161F)] p-4 text-left transition-[transform,border-color,box-shadow] duration-200 ease-spring hover:-translate-y-0.5 hover:border-[#3A4356] hover:shadow-[0_12px_30px_rgba(0,0,0,.4)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/55 active:scale-[.98] aria-pressed:border-primary aria-pressed:shadow-[0_0_0_1px_#C8102E,0_10px_34px_rgba(200,16,46,.35),inset_0_0_22px_rgba(200,16,46,.12)]"
              >
                <span className="block font-display text-[26px] font-extrabold leading-none text-foreground">
                  Custom
                </span>
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  Any amount from $1
                </span>
              </button>
            </div>

            {showCustom && (
              <div className="mt-4">
                <Label htmlFor="customAmount">Custom amount</Label>
                {/* Custom-amount row: $ prefix inside the field frame. */}
                <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-[#12161F] px-4 transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_1px_#C8102E,0_8px_26px_rgba(200,16,46,.25)]">
                  <span className="font-display text-[20px] font-extrabold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="customAmount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="1"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="h-[54px] border-0 bg-transparent px-2.5 text-[19px] font-semibold tabular focus-visible:border-0 focus-visible:ring-0"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Fee-transparent summary — BRIEF §4 screen 03 "summary". */}
            {selectedAmount > 0 && (
              <div className="mt-5 rounded-[14px] border border-white/10 bg-[rgba(13,17,25,.92)] p-5">
                <h4 className="mb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Where your gift goes
                </h4>
                <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-sm text-muted-foreground">
                  <span>Your gift</span>
                  <span className="tabular text-foreground">${selectedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-sm text-muted-foreground">
                  <span>Bleacher Backers keeps ({platformFeePercent}%)</span>
                  <span className="tabular text-foreground">−${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-sm text-muted-foreground">
                  <span>Card processing</span>
                  <span className="tabular text-foreground">
                    {coverFees ? "+" : "−"}${processingFee.toFixed(2)}
                  </span>
                </div>
                {coverFees && (
                  <div className="flex justify-between border-b border-dashed border-white/10 py-1.5 text-sm text-muted-foreground">
                    <span>Total charged to you</span>
                    <span className="tabular text-foreground">${totalCharged.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 text-base font-semibold text-foreground">
                  <span>The team receives</span>
                  <span
                    className="font-bold tabular text-[#3ECF9C]"
                    style={{ textShadow: "0 0 18px rgba(62,207,156,.45)" }}
                  >
                    ${netToCampaign.toFixed(2)}
                  </span>
                </div>

                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-[12px] border border-white/10 bg-white/[0.03] p-3.5 transition-colors hover:border-[#3A4356]">
                  <input
                    type="checkbox"
                    checked={coverFees}
                    onChange={(e) => setCoverFees(e.target.checked)}
                    className="h-4 w-4 flex-shrink-0 cursor-pointer accent-[#22C48B]"
                  />
                  <span className="text-sm text-foreground">
                    Add{" "}
                    <span className="tabular">${processingFee.toFixed(2)}</span> so
                    the team isn&apos;t charged the card fee
                  </span>
                </label>
              </div>
            )}
          </section>

          {/* --------------------------------------------------- Step 02: donor */}
          <section>
            <div className="mb-4 flex items-baseline gap-3">
              <span
                aria-hidden
                className="font-display text-[30px] font-extrabold leading-none text-transparent"
                style={{ WebkitTextStroke: "1.5px #C8102E" }}
              >
                02
              </span>
              <h3 className="font-display text-[20px] font-extrabold uppercase tracking-[-0.01em] text-foreground">
                Who&rsquo;s giving
              </h3>
            </div>

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
                <p className="mt-1.5 text-xs text-muted-foreground">
                  We&apos;ll send a receipt. We won&apos;t add you to a mailing list.
                </p>
              </div>

              <div>
                <Label htmlFor="donorName">Your name (optional)</Label>
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
                <Label htmlFor="donorMessage">Message to the team (optional)</Label>
                <Textarea
                  id="donorMessage"
                  placeholder="Write an encouraging message..."
                  value={donorMessage}
                  onChange={(e) => setDonorMessage(e.target.value)}
                  className="mt-2 min-h-[80px]"
                  maxLength={500}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-white/10 bg-white/[0.03] p-3.5 transition-colors hover:border-[#3A4356]">
                <input
                  id="anonymous"
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="h-4 w-4 flex-shrink-0 cursor-pointer accent-[#C8102E]"
                />
                <span className="text-sm text-foreground">
                  Make my donation anonymous
                </span>
              </label>
            </div>
          </section>

          {/* ------------------------------------------------- Step 03: payment */}
          <section>
            <div className="mb-4 flex items-baseline gap-3">
              <span
                aria-hidden
                className="font-display text-[30px] font-extrabold leading-none text-transparent"
                style={{ WebkitTextStroke: "1.5px #C8102E" }}
              >
                03
              </span>
              <h3 className="font-display text-[20px] font-extrabold uppercase tracking-[-0.01em] text-foreground">
                Payment
              </h3>
            </div>

            <div className="flex min-h-[52px] items-center rounded-lg border border-white/10 bg-white/[0.05] px-3 py-3.5">
              <div className="w-full">
                {/* Stripe renders these in its own iframe, so the night palette
                    has to be handed to it explicitly. */}
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: "16px",
                        color: "#EEF1F6",
                        iconColor: "#8B93A3",
                        "::placeholder": { color: "#8B93A3" },
                      },
                      invalid: { color: "#F2614B", iconColor: "#F2614B" },
                    },
                  }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Paid securely through Stripe. We never see or store your card.
            </p>
            {IS_STRIPE_TEST_MODE && (
              <p className="mt-1 text-xs text-muted-foreground">
                Test mode: use card 4242 4242 4242 4242, any future date, any CVC.
              </p>
            )}
          </section>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="rounded-[12px] border border-warning/40 bg-warning-light p-3.5 text-sm text-warning-dark"
            >
              {error}
            </div>
          )}

          {/* Submit Button. The CTA stays solid team red even while the form is
              incomplete: the base button's disabled:opacity-50 washed #C8102E
              out to pink against the night page (BRIEF §3 "Buttons", primary). */}
          <Button
            type="submit"
            disabled={
              isLoading ||
              csrfLoading ||
              !stripe ||
              selectedAmount < 1 ||
              !donorEmail
            }
            className="h-14 w-full font-display text-base font-bold uppercase tracking-[0.02em] disabled:opacity-100 disabled:shadow-[0_0_0_1px_rgba(255,255,255,.12)_inset,0_8px_24px_rgba(200,16,46,.4)]"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Heart className="mr-2 h-5 w-5" />
                <span className="tabular">
                  Donate ${totalCharged > 0 ? totalCharged.toFixed(2) : "0.00"}
                </span>
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
        <CardContent className="pt-8 text-center">
          <p className="mb-1.5 font-display text-lg font-bold uppercase tracking-[-0.01em] text-foreground">
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
