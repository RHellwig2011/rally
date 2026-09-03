/**
 * In-place team-member email changes.
 *
 * Changing email used to be delete-and-re-add, which orphaned amountRaised on
 * the soft-deleted row. The live unique key is the partial index
 * (campaignId, email) WHERE deletedAt IS NULL — a write is allowed when the
 * only clash is a removed player, and rejected when another live row already
 * has that address.
 */

export type EmailChangeDecision =
  | { type: "unchanged" }
  | { type: "update"; email: string }
  | { type: "conflict" };

export function normalizeTeamMemberEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Decide whether a requested email change may be applied.
 *
 * `hasLiveConflict` is true when another TeamMember on the same campaign has
 * this email AND deletedAt IS NULL. Soft-deleted rows are not a conflict.
 */
export function decideTeamMemberEmailChange(input: {
  currentEmail: string | null | undefined;
  requestedEmail: string;
  hasLiveConflict: boolean;
}): EmailChangeDecision {
  const next = normalizeTeamMemberEmail(input.requestedEmail);
  if (!next) {
    return { type: "unchanged" };
  }

  const current = (input.currentEmail ?? "").trim().toLowerCase();
  if (next === current) {
    return { type: "unchanged" };
  }

  if (input.hasLiveConflict) {
    return { type: "conflict" };
  }

  return { type: "update", email: next };
}
