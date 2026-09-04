'use client';

import React from 'react';
import Link from 'next/link';

interface CSVImportModalProps {
  campaignId: string;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * Legacy CSV drop-zone. The attested import lives at
 * /dashboard/[campaignId]/roster/import (POST .../roster-import/commit).
 * This modal no longer posts to POST .../import-roster, which is 410 unless
 * ALLOW_LEGACY_ROSTER_IMPORT=true.
 */
export function CSVImportModal({ campaignId, onClose, onComplete: _onComplete }: CSVImportModalProps) {
  const wizardHref = `/dashboard/${campaignId}/roster/import`;

  return (
    <div className="fixed inset-0 bg-[rgba(4,6,10,.72)] flex items-center justify-center z-[110] p-4">
      <div className="rounded-2xl border border-white/10 bg-[linear-gradient(165deg,var(--bb-night-4),#121826)] text-foreground shadow-sheet max-w-lg w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold font-display text-foreground">
              Import team members
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Roster import now runs through a preview-and-confirm wizard so a
            column mapping can be checked and you can attest that you are
            authorised to share the list before anything is stored.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded hover:bg-muted"
            >
              Cancel
            </button>
            <Link
              href={wizardHref}
              onClick={onClose}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Open import wizard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
