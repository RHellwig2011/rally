import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from 'bleacher-backers';
import { CheckCircle2, Trophy } from 'lucide-react';

/**
 * CardHeader = flex column, space-y-1.5, p-6.
 * Its job is to stack CardTitle + CardDescription with consistent padding.
 */
export const TitleAndDescription = () => (
  <div style={{ maxWidth: 420 }}>
    <Card>
      <CardHeader>
        <CardTitle>Varsity Basketball</CardTitle>
        <CardDescription>
          Lincoln High School &middot; raising funds for new uniforms and spring
          tournament travel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0, fontSize: 14, color: '#4B5563' }}>
          $1,865 raised of $10,000 &middot; 24 players fundraising
        </p>
      </CardContent>
    </Card>
  </div>
);

/**
 * Real pattern from app/dashboard/page.tsx — header carries a title/subtitle
 * block on the left and a status pill pushed to the right.
 */
export const HeaderWithStatusPill = () => (
  <div style={{ maxWidth: 420 }}>
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-1">Westside Soccer Club</CardTitle>
            <p className="text-sm text-gray-600">Westside Athletic Association</p>
          </div>
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            ACTIVE
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0, fontSize: 14, color: '#4B5563' }}>
          Ends in 12 days &middot; $4,320 available for payout
        </p>
      </CardContent>
    </Card>
  </div>
);

/**
 * Real pattern from app/player/onboard — an icon row sits above the title,
 * inside the header, and the description takes a larger size.
 */
export const HeaderWithIcon = () => (
  <div style={{ maxWidth: 420 }}>
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-green-600 mb-2">
          <CheckCircle2 className="h-8 w-8" />
          <CardTitle>All Set!</CardTitle>
        </div>
        <CardDescription className="text-base">
          Great job completing your profile! Your parents will be notified, and
          you&rsquo;re ready to start fundraising.
        </CardDescription>
      </CardHeader>
    </Card>
  </div>
);

/**
 * Real pattern from app/(auth)/login — centered header used as a page-level
 * form heading, with className overriding the default spacing.
 */
export const CenteredAuthHeader = () => (
  <div style={{ maxWidth: 380 }}>
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
        <CardDescription className="text-center">
          Sign in to your Rally coach account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full">Sign in</Button>
      </CardContent>
    </Card>
  </div>
);
