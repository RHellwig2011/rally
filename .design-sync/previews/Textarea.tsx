import * as React from 'react';
import { Textarea, Label } from 'bleacher-backers';

export const CampaignStory = () => (
  <div style={{ maxWidth: 460 }}>
    <Label htmlFor="description">Campaign Story *</Label>
    <Textarea
      id="description"
      placeholder="Tell donors about your team and what you're raising funds for…"
      className="mt-2 min-h-[200px]"
    />
    <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.6 }}>0 / 2,000 characters</p>
  </div>
);

export const DonorMessage = () => (
  <div style={{ maxWidth: 460 }}>
    <Label htmlFor="donorMessage">Message to Campaign (Optional)</Label>
    <Textarea
      id="donorMessage"
      maxLength={500}
      className="mt-2"
      defaultValue="Go Lions! Watched every game this season — good luck at the state tournament."
    />
    <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.6 }}>78 / 500 characters</p>
  </div>
);

export const DisbursementDescription = () => (
  <div style={{ maxWidth: 460 }}>
    <Label htmlFor="disbursementDescription">Description * (min 10 characters)</Label>
    <Textarea
      id="disbursementDescription"
      rows={3}
      className="mt-2"
      defaultValue="Tournament registration for the Regional Classic on March 14 — 24 players, $65 per athlete."
    />
  </div>
);

export const TextareaStates = () => (
  <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <Label htmlFor="taEmpty">Empty — placeholder</Label>
      <Textarea id="taEmpty" placeholder="Write an encouraging message…" className="mt-2" />
    </div>
    <div>
      <Label htmlFor="taDisabled">Disabled — request already approved</Label>
      <Textarea
        id="taDisabled"
        disabled
        className="mt-2"
        defaultValue="Approved by Dana Whitfield on Mar 2 — $1,560 paid out to Lincoln High Athletics."
      />
    </div>
  </div>
);
