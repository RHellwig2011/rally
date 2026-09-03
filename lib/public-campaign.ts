export const PUBLIC_CAMPAIGN_STATUSES = ["ACTIVE", "COMPLETED"] as const;

export function isPubliclyListableCampaign(status: string): boolean {
  return status === "ACTIVE" || status === "COMPLETED";
}
