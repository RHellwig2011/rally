import * as React from 'react';
import { Label, Input, Textarea } from 'bleacher-backers';

export const LabeledInput = () => (
  <div style={{ maxWidth: 420 }}>
    <Label htmlFor="organizationName">Organization Name *</Label>
    <Input
      id="organizationName"
      autoComplete="organization"
      defaultValue="Lincoln High School"
      className="mt-2"
    />
  </div>
);

export const RequiredAndOptional = () => (
  <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <Label htmlFor="playerName">Full Name *</Label>
      <Input id="playerName" defaultValue="Jordan Reyes" className="mt-2" />
    </div>
    <div>
      <Label htmlFor="personalGoal">Personal Fundraising Goal (Optional)</Label>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 14, opacity: 0.6, marginRight: 8 }}>$</span>
        <Input id="personalGoal" type="number" placeholder="500" className="flex-1" />
      </div>
    </div>
  </div>
);

export const LabeledTextarea = () => (
  <div style={{ maxWidth: 460 }}>
    <Label htmlFor="outreachMessage">Message to Supporters</Label>
    <Textarea
      id="outreachMessage"
      rows={4}
      className="mt-2"
      defaultValue="Hi! I'm Jordan, a sophomore forward on Lincoln High Varsity Basketball. We're raising $10,000 for new uniforms and travel to the state tournament. Any amount helps!"
    />
  </div>
);

export const CheckboxLabels = () => (
  <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input
        id="anonymous"
        type="checkbox"
        defaultChecked
        className="peer w-4 h-4"
        style={{ accentColor: '#6366F1' }}
      />
      <Label htmlFor="anonymous" className="ml-3 font-normal">
        Make my donation anonymous
      </Label>
    </div>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input
        id="coverFees"
        type="checkbox"
        disabled
        className="peer w-4 h-4"
        style={{ accentColor: '#6366F1' }}
      />
      <Label htmlFor="coverFees" className="ml-3 font-normal">
        Cover the $1.03 processing fee (unavailable for offline gifts)
      </Label>
    </div>
  </div>
);
