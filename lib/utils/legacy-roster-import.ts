/**
 * The pre-attestation CSV import at POST /api/campaigns/:id/import-roster.
 * Off unless an operator explicitly opts back in.
 */
type EnvFlagBag = { ALLOW_LEGACY_ROSTER_IMPORT?: string };

export function isLegacyRosterImportEnabled(env?: EnvFlagBag): boolean {
  const source = env ?? (process.env as EnvFlagBag);
  return source.ALLOW_LEGACY_ROSTER_IMPORT === "true";
}

export const LEGACY_ROSTER_IMPORT_GONE = {
  success: false as const,
  error:
    "This import endpoint is gone. Import from /dashboard/[campaignId]/roster/import, which requires an attestation before any roster is stored.",
  code: "LEGACY_ROSTER_IMPORT_GONE" as const,
};
