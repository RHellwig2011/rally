"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  DollarSign,
  User,
  Mail,
  Phone,
  MessageSquare,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// TODO: Install checkbox component - temporarily commented out for Week 1 build
// import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface DonationFormProps {
  campaignId: string;
  teamMemberId?: string;
  campaignName: string;
  teamMemberName?: string;
  campaignGoal: number;
  campaignRaised: number;
  teamMemberGoal?: number;
  teamMemberRaised?: number;
}

function DonationFormContent({
  campaignId,
  teamMemberId,
  campaignName,
  teamMemberName,
  campaignGoal,
  campaignRaised,
  teamMemberGoal,
  teamMemberRaised,
}: DonationFormProps) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  // Form state
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Suggested donation amounts
  const suggestedAmounts = [25, 50, 100, 250];

  const handleAmountSelect = (value: number) => {
    setAmount(value);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setAmount(numValue);
    } else {
      setAmount(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Stripe is not loaded. Please refresh and try again.");
      return;
    }

    if (!amount || amount <= 0) {
      setError("Please select or enter a valid donation amount.");
      return;
    }

    if (!donorName || !donorEmail) {
      setError("Please provide your name and email.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Create donation and payment intent on backend
      const response = await fetch('/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId,
          teamMemberId,
          amount,
          donorName,
          donorEmail,
          donorPhone,
          message,
          isAnonymous,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create donation');
      }

      const { clientSecret, donation } = data;

      // Step 2: Confirm payment with Stripe
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: donorName,
              email: donorEmail,
              phone: donorPhone || undefined,
            },
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // Step 3: Verify payment on backend
      const verifyResponse = await fetch(`/api/donations/${donation.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntent?.id,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Failed to verify payment');
      }

      // Success!
      setSuccess(true);

      // Redirect to success page after 3 seconds
      setTimeout(() => {
        router.push(`/raise/${campaignId}/thank-you?donation=${donation.id}`);
      }, 3000);

    } catch (err) {
      console.error('Donation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsProcessing(false);
    }
  };

  if (success) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
            <h2 className="text-2xl font-bold text-green-600">Thank You!</h2>
            <p className="text-lg">Your donation of {formatCurrency(amount || 0)} has been processed successfully.</p>
            <p className="text-muted-foreground">
              You will receive a confirmation email shortly at {donorEmail}.
            </p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Make a Donation</CardTitle>
        <CardDescription>
          Supporting {teamMemberName ? `${teamMemberName} for ` : ''}{campaignName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Progress Display */}
          <div className="bg-secondary/20 rounded-lg p-4">
            <div className="space-y-2">
              {teamMemberName && teamMemberGoal && (
                <div>
                  <div className="flex justify-between text-sm">
                    <span>{teamMemberName}'s Progress</span>
                    <span>{formatCurrency(teamMemberRaised || 0)} of {formatCurrency(teamMemberGoal)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((teamMemberRaised || 0) / teamMemberGoal) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <div>
                <div className="flex justify-between text-sm">
                  <span>Campaign Progress</span>
                  <span>{formatCurrency(campaignRaised)} of {formatCurrency(campaignGoal)}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (campaignRaised / campaignGoal) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Amount Selection */}
          <div className="space-y-3">
            <Label>Select or enter amount</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {suggestedAmounts.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={amount === value && !customAmount ? "default" : "outline"}
                  onClick={() => handleAmountSelect(value)}
                  className="w-full"
                >
                  ${value}
                </Button>
              ))}
            </div>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Enter custom amount"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className="pl-9 h-12"
                min="1"
                step="0.01"
              />
            </div>
          </div>

          {/* Donor Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  <User className="inline h-4 w-4 mr-1" />
                  Full Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  required
                  disabled={isProcessing}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="inline h-4 w-4 mr-1" />
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  required
                  disabled={isProcessing}
                  className="h-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">
                <Phone className="inline h-4 w-4 mr-1" />
                Phone (optional)
              </Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
                disabled={isProcessing}
                className="h-12"
              />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">
              <MessageSquare className="inline h-4 w-4 mr-1" />
              Message to {teamMemberName || 'campaign'} (optional)
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share some words of encouragement..."
              rows={3}
              maxLength={500}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">{message.length}/500 characters</p>
          </div>

          {/* Anonymous Option */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="anonymous"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              disabled={isProcessing}
              className="rounded border-gray-300"
            />
            <Label htmlFor="anonymous" className="flex items-center cursor-pointer">
              {isAnonymous ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              Make this donation anonymous
            </Label>
          </div>

          {/* Card Element */}
          <div className="space-y-2">
            <Label>Payment Details</Label>
            <div className="p-4 sm:p-3 border rounded-md min-h-[48px] flex items-center">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      lineHeight: '24px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                      padding: '12px 0',
                    },
                    invalid: {
                      color: '#ef4444',
                      iconColor: '#ef4444',
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!stripe || isProcessing || !amount}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Donate {amount ? formatCurrency(amount) : ''}
              </>
            )}
          </Button>

          {/* Security Note */}
          <p className="text-xs text-center text-muted-foreground">
            Your payment information is secure and encrypted. We never store your card details.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

// Wrapper component with Stripe Elements provider
export default function DonationForm(props: DonationFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <DonationFormContent {...props} />
    </Elements>
  );
}