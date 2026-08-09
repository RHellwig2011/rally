import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  Button,
} from 'bleacher-backers';
import {
  ChevronDown,
  Mail,
  Share2,
  Download,
  FileSpreadsheet,
  Receipt,
  Users,
  Trophy,
} from 'lucide-react';

// DropdownMenuLabel is a section heading — it only reads true inside an open
// menu, so the cell shows the whole menu it labels.
export const LabelledGroups = () => (
  <div style={{ minHeight: 320 }}>
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Roster tools
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Outreach</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Mail className="w-4 h-4" />
            <span className="ml-2">Email all players</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Share2 className="w-4 h-4" />
            <span className="ml-2">Share team page</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Reports</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <FileSpreadsheet className="w-4 h-4" />
            <span className="ml-2">Donor export</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Receipt className="w-4 h-4" />
            <span className="ml-2">Disbursement history</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

// The account-header pattern: a label carrying two lines of identity, then items.
export const AccountHeadingLabel = () => (
  <div style={{ minHeight: 300 }}>
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Coach Alvarez
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>Coach Alvarez</span>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.65 }}>
              alvarez@lincolnhigh.org
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Trophy className="w-4 h-4" />
          <span className="ml-2">My campaigns</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Users className="w-4 h-4" />
          <span className="ml-2">Team settings</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

// inset — the label indents to line up with items that reserve an indicator gutter.
export const InsetLabel = () => (
  <div style={{ minHeight: 280 }}>
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Export donors
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel inset>Date range</DropdownMenuLabel>
        <DropdownMenuItem inset>Season to date</DropdownMenuItem>
        <DropdownMenuItem inset>Last 30 days</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel inset>Format</DropdownMenuLabel>
        <DropdownMenuItem inset>
          <Download className="w-4 h-4" />
          <span className="ml-2">CSV</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
