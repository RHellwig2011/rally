import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea,
} from 'bleacher-backers';
import { CheckCircle, UserMinus } from 'lucide-react';

// Ported from app/admin/disbursements/page.tsx — the admin approve-payout confirm.
export const ApproveDisbursement = () => (
  <Dialog defaultOpen>
    <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Approve Disbursement</DialogTitle>
        <DialogDescription>
          Are you sure you want to approve this disbursement request?
        </DialogDescription>
      </DialogHeader>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>Amount</p>
          <p style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 700 }}>$1,865.00</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>Campaign</p>
          <p style={{ margin: '2px 0 0', fontWeight: 600 }}>Lincoln High Varsity Basketball</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>Purpose</p>
          <p style={{ margin: '2px 0 0' }}>Spring tournament travel and new uniforms</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>
          <CheckCircle className="w-4 h-4" />
          Approve Disbursement
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

// Ported from app/dashboard/[campaignId]/roster/page.tsx — the add-player form dialog.
export const AddTeamMember = () => (
  <Dialog defaultOpen>
    <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Add Team Member</DialogTitle>
        <DialogDescription>
          Invite a new member to your team. They&rsquo;ll receive an email with instructions.
        </DialogDescription>
      </DialogHeader>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <Label htmlFor="dlg-name">Full Name *</Label>
          <Input id="dlg-name" defaultValue="Marcus Whitfield" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="dlg-goal">Personal Fundraising Goal</Label>
          <Input id="dlg-goal" type="number" defaultValue="500" className="mt-1" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Add Member</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

// A confirm-with-reason flow, mirroring the admin reject-disbursement dialog.
export const RemovePlayerConfirm = () => (
  <Dialog defaultOpen>
    <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Remove Player from Roster</DialogTitle>
        <DialogDescription>
          Marcus Whitfield has raised $340 so far. Those donations stay with the campaign.
        </DialogDescription>
      </DialogHeader>
      <div>
        <Label htmlFor="dlg-reason">Reason (shared with the coach)</Label>
        <Textarea
          id="dlg-reason"
          className="mt-1"
          rows={3}
          defaultValue="Transferred to another school for the spring season."
        />
      </div>
      <DialogFooter>
        <Button variant="outline">Keep on Roster</Button>
        <Button variant="destructive">
          <UserMinus className="w-4 h-4" />
          Remove Player
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
