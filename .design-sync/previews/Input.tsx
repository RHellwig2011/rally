import * as React from 'react';
import { Input, Label } from 'bleacher-backers';
import { Search } from 'lucide-react';

export const DonorFields = () => (
  <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <Label htmlFor="donorEmail">Email Address *</Label>
      <Input
        id="donorEmail"
        type="email"
        autoComplete="email"
        placeholder="your@email.com"
        className="mt-2"
      />
      <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.6 }}>For donation receipt</p>
    </div>
    <div>
      <Label htmlFor="donorName">Your Name (Optional)</Label>
      <Input
        id="donorName"
        type="text"
        autoComplete="name"
        defaultValue="Maria Delgado"
        className="mt-2"
      />
    </div>
  </div>
);

export const InputStates = () => (
  <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <Label htmlFor="stateEmpty">Empty — placeholder</Label>
      <Input id="stateEmpty" placeholder="Lincoln High School" className="mt-2" />
    </div>
    <div>
      <Label htmlFor="stateFilled">Filled</Label>
      <Input id="stateFilled" defaultValue="Lincoln High Varsity Basketball" className="mt-2" />
    </div>
    <div>
      <Label htmlFor="stateDisabled">Disabled — payouts locked</Label>
      <Input id="stateDisabled" defaultValue="acct_1Q8kLincolnHigh" disabled className="mt-2" />
    </div>
  </div>
);

export const PrefixedInputs = () => (
  <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <Label htmlFor="goalAmount">Fundraising Goal *</Label>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 14, opacity: 0.6, marginRight: 8 }}>$</span>
        <Input
          id="goalAmount"
          type="number"
          inputMode="numeric"
          defaultValue="10000"
          className="flex-1"
        />
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.6 }}>Maximum: $100,000</p>
    </div>
    <div>
      <Label htmlFor="slug">Campaign URL</Label>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 14, opacity: 0.6, marginRight: 8, whiteSpace: 'nowrap' }}>
          rally.com/raise/
        </span>
        <Input id="slug" defaultValue="lincoln-high-hoops" className="flex-1" />
      </div>
    </div>
  </div>
);

export const SearchInput = () => (
  <div style={{ maxWidth: 420 }}>
    <div style={{ position: 'relative' }}>
      <Search
        className="w-4 h-4"
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.5,
        }}
      />
      <Input placeholder="Search campaigns, purposes, or requesters…" className="pl-10" />
    </div>
  </div>
);

export const DateRangeFields = () => (
  <div style={{ maxWidth: 440, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
    <div>
      <Label htmlFor="startDate">Start Date</Label>
      <Input id="startDate" type="date" defaultValue="2026-03-01" className="mt-2" />
    </div>
    <div>
      <Label htmlFor="endDate">End Date (Optional)</Label>
      <Input id="endDate" type="date" defaultValue="2026-05-31" className="mt-2" />
    </div>
  </div>
);
