import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Progress,
  Label,
  Input,
} from 'bleacher-backers';
import { DollarSign, Calendar } from 'lucide-react';

/**
 * CardContent = p-6 pt-0. It sits flush under a CardHeader, inheriting the
 * header's bottom spacing rather than adding its own top padding.
 */
export const ContentUnderHeader = () => (
  <div style={{ maxWidth: 420 }}>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Fundraiser progress</CardTitle>
        <CardDescription>Spring tournament travel fund</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-gray-900">$1,865.00</span>
              <span className="text-gray-600">of $10,000.00</span>
            </div>
            <Progress value={19} />
            <p className="text-xs text-gray-600 mt-1">19% raised</p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-600">Available</p>
                <p className="text-sm font-semibold text-gray-900">$1,712.40</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-gray-600">Days left</p>
                <p className="text-sm font-semibold text-gray-900">12</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

/**
 * Real pattern from app/admin/disbursements — headerless stat cards where
 * CardContent restores its own top padding with pt-6.
 */
export const HeaderlessStatContent = () => (
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    <Card style={{ minWidth: 150 }}>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold text-gray-900">7</div>
        <div className="text-sm text-gray-600">Pending payouts</div>
      </CardContent>
    </Card>
    <Card style={{ minWidth: 150 }}>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold text-green-600">42</div>
        <div className="text-sm text-gray-600">Approved</div>
      </CardContent>
    </Card>
    <Card style={{ minWidth: 150 }}>
      <CardContent className="pt-6">
        <div className="text-lg font-bold text-gray-900">$18,940.00</div>
        <div className="text-sm text-gray-600">Pending amount</div>
      </CardContent>
    </Card>
  </div>
);

/**
 * CardContent as a form body — the donation flow wraps its fields in the
 * content slot so padding matches the header above it.
 */
export const FormContent = () => (
  <div style={{ maxWidth: 400 }}>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Request a disbursement</CardTitle>
        <CardDescription>Funds arrive in 2&ndash;3 business days.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" defaultValue="$1,250.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo">Memo</Label>
            <Input id="memo" defaultValue="Tournament hotel deposit" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);
