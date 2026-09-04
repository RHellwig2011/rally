import * as React from 'react';
import { Button } from 'bleacher-backers';
import { Heart, ArrowRight, Loader2 } from 'lucide-react';

export const Variants = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
    <Button>Donate $25</Button>
    <Button variant="outline">Share campaign</Button>
    <Button variant="secondary">View roster</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="destructive">Remove player</Button>
    <Button variant="link">Terms &amp; Privacy</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Support this team</Button>
    <Button size="icon" aria-label="Favorite">
      <Heart className="w-4 h-4" />
    </Button>
  </div>
);

export const WithIcons = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
    <Button>
      <Heart className="w-4 h-4" />
      Donate now
    </Button>
    <Button variant="outline">
      Continue to payment
      <ArrowRight className="w-4 h-4" />
    </Button>
  </div>
);

export const States = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
    <Button disabled>Unavailable</Button>
    <Button disabled>
      <Loader2 className="w-4 h-4 animate-spin" />
      Processing…
    </Button>
    <Button variant="outline" disabled>
      Campaign ended
    </Button>
  </div>
);

export const FullWidth = () => (
  <div style={{ maxWidth: 360 }}>
    <Button size="lg" className="w-full">
      <Heart className="w-4 h-4" />
      Donate $50 to Varsity Basketball
    </Button>
  </div>
);
