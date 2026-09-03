export function leaderMayActivateCampaign(opts: {
  role: string;
  organizationVerifiedAt: Date | null | undefined;
}): boolean {
  if (opts.role === "ADMIN" || opts.role === "BANK_ADMIN") {
    return true;
  }
  return Boolean(opts.organizationVerifiedAt);
}
