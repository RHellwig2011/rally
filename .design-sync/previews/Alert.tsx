import * as React from 'react';
import { Alert, AlertTitle, AlertDescription } from 'bleacher-backers';
import { Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export const Variants = () => (
  <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Payouts run every Friday</AlertTitle>
      <AlertDescription>
        Funds raised this week will be available in your account after the next disbursement.
      </AlertDescription>
    </Alert>
    <Alert variant="success">
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>Goal reached</AlertTitle>
      <AlertDescription>
        Varsity Basketball hit its $10,000 goal. You can still accept donations.
      </AlertDescription>
    </Alert>
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Low available balance</AlertTitle>
      <AlertDescription>
        Pending disbursements exceed your available balance. Approve payouts to continue.
      </AlertDescription>
    </Alert>
    <Alert variant="destructive">
      <XCircle className="h-4 w-4" />
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>
        The card was declined. Ask the donor to try a different payment method.
      </AlertDescription>
    </Alert>
  </div>
);

export const TitleOnly = () => (
  <div style={{ maxWidth: 520 }}>
    <Alert variant="success">
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>Roster imported — 24 players added</AlertTitle>
    </Alert>
  </div>
);

export const WithoutIcon = () => (
  <div style={{ maxWidth: 520 }}>
    <Alert>
      <AlertTitle>Campaign is in draft</AlertTitle>
      <AlertDescription>
        Publish the campaign to start accepting donations and share player links.
      </AlertDescription>
    </Alert>
  </div>
);
