export type TeamMemberAttribution =
  | { status: "omit" }
  | { status: "use"; teamMemberId: string }
  | { status: "reject" };

/**
 * Policy for POST /api/donations (and the webhook fallback): a supplied
 * teamMemberId that does not resolve to a live member on this campaign is a
 * client error, not a silent campaign-level donation.
 */
export function decideTeamMemberAttribution(
  provided: string | undefined | null,
  resolvedId: string | undefined | null
): TeamMemberAttribution {
  const identifier = provided?.trim() ?? "";
  if (!identifier) {
    return { status: "omit" };
  }
  if (!resolvedId) {
    return { status: "reject" };
  }
  return { status: "use", teamMemberId: resolvedId };
}

/** Lookup used by donation create + processDonation fallback. */
export function teamMemberAttributionWhere(
  campaignId: string,
  identifier: string
) {
  return {
    campaignId,
    deletedAt: null as null,
    OR: [{ id: identifier }, { fundLinkCode: identifier }],
  };
}
