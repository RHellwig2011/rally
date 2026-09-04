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
import { CheckCircle, XCircle, Share2 } from 'lucide-react';

/**
 * CardFooter = flex items-center p-6 pt-0. Default use: a single full-width
 * primary action closing out the card.
 */
export const SingleAction = () => (
  <div style={{ maxWidth: 400 }}>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Riverside Track &amp; Field</CardTitle>
        <CardDescription>Help send 32 athletes to the state meet.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-gray-900">$6,400</span>
          <span className="text-gray-600">of $8,000</span>
        </div>
        <Progress value={80} />
      </CardContent>
      <CardFooter>
        <Button className="w-full">Donate $25</Button>
      </CardFooter>
    </Card>
  </div>
);

/**
 * Real pattern from app/admin/disbursements — the footer holds an approve /
 * reject pair that splits the row evenly.
 */
export const ApproveRejectActions = () => (
  <div style={{ maxWidth: 440 }}>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Disbursement #4821</CardTitle>
        <CardDescription>
          Lincoln High Varsity Basketball requested $1,250.00
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600" style={{ margin: 0 }}>
          Submitted by Coach Alvarez &middot; 2 days ago
        </p>
      </CardContent>
      <CardFooter className="gap-3">
        <Button className="flex-1">
          <CheckCircle className="w-4 h-4 mr-2" />
          Approve
        </Button>
        <Button variant="outline" className="flex-1">
          <XCircle className="w-4 h-4 mr-2" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  </div>
);

/**
 * Footer as a meta bar: items-center keeps the helper text and the trailing
 * action on the same baseline. justify-between pushes them apart.
 */
export const FooterWithMeta = () => (
  <div style={{ maxWidth: 440 }}>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Maya Torres</CardTitle>
        <CardDescription>Forward &middot; Class of 2027</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-gray-900">$310 raised</span>
          <span className="text-gray-600">of $400</span>
        </div>
        <Progress value={78} />
      </CardContent>
      <CardFooter className="justify-between border-t border-gray-200 pt-4">
        <span className="text-xs text-gray-600">Last donation 3 hours ago</span>
        <Button variant="outline" size="sm">
          <Share2 className="w-4 h-4 mr-2" />
          Share page
        </Button>
      </CardFooter>
    </Card>
  </div>
);
