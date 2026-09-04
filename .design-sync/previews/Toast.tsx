import * as React from 'react';
import {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
} from 'bleacher-backers';

/**
 * Toast is a Radix set: the Root must live inside a ToastProvider and be
 * rendered through a ToastViewport. Previews pin `open` so the toast does not
 * auto-dismiss.
 *
 * ToastViewport is hard-`fixed` to the screen corner. Fixed elements contribute
 * nothing to the measured height of the card root, so the product card
 * photographs blank even though the toast is on screen. `viewportStyle` puts the
 * viewport back into normal flow for the card. Inline styles are used rather
 * than utility classes because they always beat the class and never depend on
 * whether the class survived the Tailwind content scan (see NOTES.md).
 */
const viewportStyle: React.CSSProperties = {
  position: 'static',
  maxWidth: 'none',
  width: '100%',
  padding: 0,
};
export const DonationReceived = () => (
  <ToastProvider duration={1000000}>
    <Toast open>
      <div className="grid gap-1">
        <ToastTitle>Donation received</ToastTitle>
        <ToastDescription>
          $50 from Maria Alvarez to Lincoln High Varsity Basketball.
        </ToastDescription>
      </div>
      <ToastClose />
    </Toast>
    <ToastViewport style={viewportStyle} />
  </ToastProvider>
);

export const WithAction = () => (
  <ToastProvider duration={1000000}>
    <Toast open>
      <div className="grid gap-1">
        <ToastTitle>Roster imported</ToastTitle>
        <ToastDescription>24 players added, 2 duplicates skipped.</ToastDescription>
      </div>
      <ToastAction altText="Review the imported roster">Review</ToastAction>
      <ToastClose />
    </Toast>
    <ToastViewport style={viewportStyle} />
  </ToastProvider>
);

export const ProfileSaved = () => (
  <ToastProvider duration={1000000}>
    <Toast open>
      <div className="grid gap-1">
        <ToastTitle>Success!</ToastTitle>
        <ToastDescription>Your player profile has been updated.</ToastDescription>
      </div>
      <ToastClose />
    </Toast>
    <ToastViewport style={viewportStyle} />
  </ToastProvider>
);

/**
 * The destructive variant renders flat: tailwind.config.ts does not register a
 * `destructive` color, so bg-destructive / text-destructive-foreground emit
 * nothing. This is a faithful render of that gap, not a preview defect.
 */
export const DestructiveVariant = () => (
  <ToastProvider duration={1000000}>
    <Toast open variant="destructive">
      <div className="grid gap-1">
        <ToastTitle>Payment failed</ToastTitle>
        <ToastDescription>
          The card was declined. Ask the donor to try another payment method.
        </ToastDescription>
      </div>
      <ToastAction altText="Retry the declined donation">Try again</ToastAction>
      <ToastClose />
    </Toast>
    <ToastViewport style={viewportStyle} />
  </ToastProvider>
);
