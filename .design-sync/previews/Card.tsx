import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Progress,
} from 'bleacher-backers';
import { Users, TrendingUp } from 'lucide-react';

export const CampaignCard = () => (
  <div style={{ maxWidth: 420 }}>
    <Card>
      <CardHeader>
        <CardTitle>Lincoln High Varsity Basketball</CardTitle>
        <CardDescription>
          Raising funds for new uniforms and spring tournament travel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>$1,865 raised</span>
          <span style={{ opacity: 0.65 }}>of $10,000</span>
        </div>
        <Progress value={19} />
      </CardContent>
      <CardFooter style={{ gap: 12 }}>
        <Button className="w-full">Donate</Button>
        <Button variant="outline" className="w-full">
          Share
        </Button>
      </CardFooter>
    </Card>
  </div>
);

export const StatCard = () => (
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    <Card style={{ minWidth: 190 }}>
      <CardHeader>
        <CardDescription>Total raised</CardDescription>
        <CardTitle>$1,865.00</CardTitle>
      </CardHeader>
      <CardContent>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
          <TrendingUp className="w-4 h-4" />
          13 donations
        </span>
      </CardContent>
    </Card>
    <Card style={{ minWidth: 190 }}>
      <CardHeader>
        <CardDescription>Team members</CardDescription>
        <CardTitle>24 players</CardTitle>
      </CardHeader>
      <CardContent>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
          <Users className="w-4 h-4" />
          18 actively fundraising
        </span>
      </CardContent>
    </Card>
  </div>
);

export const ContentOnly = () => (
  <div style={{ maxWidth: 420 }}>
    <Card>
      <CardContent style={{ paddingTop: 24 }}>
        <p style={{ margin: 0 }}>
          A card can hold plain content with no header or footer — useful for inline panels
          and empty states.
        </p>
      </CardContent>
    </Card>
  </div>
);
