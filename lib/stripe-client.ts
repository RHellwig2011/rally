import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

/**
 * Get the Stripe.js instance
 * This should be called on the client side only
 */
export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined');
      return null;
    }

    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

/**
 * Create a payment intent on the server and return the client secret
 */
export async function createPaymentIntent({
  campaignId,
  amount,
  donorEmail,
  donorName,
  referralCode,
}: {
  campaignId: string;
  amount: number;
  donorEmail: string;
  donorName?: string;
  referralCode?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const response = await fetch('/api/payments/create-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      campaignId,
      amount,
      donorEmail,
      donorName,
      referralCode,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create payment intent');
  }

  const data = await response.json();
  return {
    clientSecret: data.clientSecret,
    paymentIntentId: data.paymentIntentId,
  };
}

/**
 * Process a donation after successful Stripe payment
 */
export async function processDonationWithStripe({
  campaignId,
  amount,
  donorEmail,
  donorName,
  donorMessage,
  isAnonymous,
  referralCode,
  paymentIntentId,
}: {
  campaignId: string;
  amount: number;
  donorEmail: string;
  donorName?: string;
  donorMessage?: string;
  isAnonymous?: boolean;
  referralCode?: string;
  paymentIntentId: string;
}) {
  const response = await fetch('/api/donations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      campaignId,
      amount,
      donorEmail,
      donorName,
      donorMessage,
      isAnonymous,
      referralCode,
      paymentIntentId,
      useStripe: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process donation');
  }

  return response.json();
}

/**
 * Example usage in a React component:
 *
 * ```tsx
 * import { getStripe, createPaymentIntent, processDonationWithStripe } from '@/lib/stripe-client';
 * import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
 *
 * // In your component:
 * const stripePromise = getStripe();
 *
 * function CheckoutForm({ campaignId, amount, donorEmail }) {
 *   const stripe = useStripe();
 *   const elements = useElements();
 *   const [clientSecret, setClientSecret] = useState('');
 *   const [paymentIntentId, setPaymentIntentId] = useState('');
 *
 *   useEffect(() => {
 *     createPaymentIntent({ campaignId, amount, donorEmail })
 *       .then(({ clientSecret, paymentIntentId }) => {
 *         setClientSecret(clientSecret);
 *         setPaymentIntentId(paymentIntentId);
 *       });
 *   }, [campaignId, amount, donorEmail]);
 *
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *
 *     if (!stripe || !elements) return;
 *
 *     const { error } = await stripe.confirmPayment({
 *       elements,
 *       confirmParams: {
 *         return_url: `${window.location.origin}/donate/success`,
 *       },
 *       redirect: 'if_required',
 *     });
 *
 *     if (!error) {
 *       await processDonationWithStripe({
 *         campaignId,
 *         amount,
 *         donorEmail,
 *         paymentIntentId,
 *       });
 *     }
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <PaymentElement />
 *       <button type="submit" disabled={!stripe}>Pay</button>
 *     </form>
 *   );
 * }
 *
 * // In parent component:
 * <Elements stripe={stripePromise} options={{ clientSecret }}>
 *   <CheckoutForm campaignId={id} amount={amount} donorEmail={email} />
 * </Elements>
 * ```
 */
