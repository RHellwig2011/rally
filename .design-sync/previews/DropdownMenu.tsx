import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Button,
} from 'bleacher-backers';
import {
  ChevronDown,
  Pencil,
  Share2,
  Download,
  Trash2,
  Rocket,
  PauseCircle,
  Archive,
  Clock,
  Mail,
  UserMinus,
  MoreHorizontal,
} from 'lucide-react';

export const CampaignActionsMenu = () => (
  <DropdownMenu defaultOpen modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline">
        Campaign Actions
        <ChevronDown className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-56">
      <DropdownMenuLabel>Lincoln High Basketball</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <Pencil className="w-4 h-4" />
        <span className="ml-2">Edit campaign</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Share2 className="w-4 h-4" />
        <span className="ml-2">Share link</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Download className="w-4 h-4" />
        <span className="ml-2">Export donors</span>
        <DropdownMenuShortcut>CSV</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <Trash2 className="w-4 h-4" />
        <span className="ml-2">Delete campaign</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// Ported from app/dashboard/[campaignId]/page.tsx — the campaign status transition menu.
export const CampaignStatusMenu = () => (
  <DropdownMenu defaultOpen modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" className="font-semibold">
        <Rocket className="w-4 h-4" />
        <span className="ml-1">ACTIVE</span>
        <ChevronDown className="ml-1 w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-56">
      <DropdownMenuLabel>Change Status</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <PauseCircle className="w-4 h-4" />
        <span className="ml-2">Pause campaign</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Archive className="w-4 h-4" />
        <span className="ml-2">Archive campaign</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <Clock className="w-4 h-4" />
        <span className="ml-2">View History</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const PlayerRowMenu = () => (
  <div
    style={{
      width: 420,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '8px 8px 8px 14px',
    }}
  >
    <div>
      <div style={{ fontWeight: 600 }}>Marcus Whitfield</div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>$340 raised of $500 goal</div>
    </div>
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Player actions">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Marcus Whitfield</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Mail className="w-4 h-4" />
          <span className="ml-2">Resend invite</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Share2 className="w-4 h-4" />
          <span className="ml-2">Copy player link</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Download className="w-4 h-4" />
          <span className="ml-2">Download receipts</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <UserMinus className="w-4 h-4" />
          <span className="ml-2">Remove from roster</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
