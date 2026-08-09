import * as React from 'react';
import {
  Progress,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
} from 'bleacher-backers';
import { Users } from 'lucide-react';

/**
 * Progress takes real dollar amounts: `value` = raised, `max` = goal.
 * `className` lands on the outer wrapper, not the 12px track.
 */
export const FundingLevels = () => {
  const campaigns = [
    { team: 'Westview Girls Soccer', raised: 0, goal: 6000 },
    { team: 'Lincoln High Varsity Basketball', raised: 1865, goal: 10000 },
    { team: 'Riverside Track & Field', raised: 5100, goal: 7500 },
    { team: 'Oak Ridge Marching Band', raised: 12000, goal: 12000 },
  ];
  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 460 }}>
      {campaigns.map((c) => (
        <div key={c.team}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span style={{ fontWeight: 600 }}>{c.team}</span>
            <span className="text-sm text-gray-600">
              ${c.raised.toLocaleString()} of ${c.goal.toLocaleString()}
            </span>
          </div>
          <Progress value={c.raised} max={c.goal} />
        </div>
      ))}
    </div>
  );
};

export const DonationWidget = () => (
  <div style={{ maxWidth: 380 }}>
    <Card className="shadow-lg">
      <CardContent className="pt-6">
        <div
          className="mb-2"
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <span className="text-3xl font-bold text-gray-900">$1,865</span>
          <span className="text-gray-600">of $10,000</span>
        </div>
        <Progress value={1865} max={10000} className="mb-2" />
        <div
          className="text-sm text-gray-600"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span className="font-semibold text-primary">19% funded</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Users className="w-4 h-4" />
            13 donors
          </span>
        </div>
        <Button className="w-full mt-6">Donate $25</Button>
      </CardContent>
    </Card>
  </div>
);

export const WithLabel = () => (
  <div style={{ maxWidth: 380 }}>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Maya Alvarez — #12</CardTitle>
        <CardDescription>Personal goal for the spring tournament</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="mb-2"
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <span className="text-2xl font-bold text-gray-900">$340</span>
          <span className="text-sm text-gray-600">of $500</span>
        </div>
        <Progress value={340} max={500} showLabel />
      </CardContent>
    </Card>
  </div>
);

export const PlayerLeaderboard = () => {
  const players = [
    { name: 'Maya Alvarez', raised: 340 },
    { name: 'Jordan Pak', raised: 275 },
    { name: 'Devin Carter', raised: 180 },
    { name: 'Sam Whitfield', raised: 45 },
  ];
  return (
    <div style={{ maxWidth: 420 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top fundraisers</CardTitle>
          <CardDescription>Each player is working toward a $500 goal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {players.map((p) => (
            <div key={p.name}>
              <div
                className="mb-2 text-sm"
                style={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <span className="font-medium text-gray-900">{p.name}</span>
                <span className="text-gray-600">${p.raised} raised</span>
              </div>
              <Progress value={p.raised} max={500} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
