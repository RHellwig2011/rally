/**
 * @jest-environment node
 */

import { isPubliclyListableCampaign } from "@/lib/public-campaign";
import { leaderMayActivateCampaign } from "@/lib/org-verification";

describe("isPubliclyListableCampaign", () => {
  it("allows ACTIVE and COMPLETED only", () => {
    expect(isPubliclyListableCampaign("ACTIVE")).toBe(true);
    expect(isPubliclyListableCampaign("COMPLETED")).toBe(true);
    expect(isPubliclyListableCampaign("DRAFT")).toBe(false);
    expect(isPubliclyListableCampaign("PAUSED")).toBe(false);
    expect(isPubliclyListableCampaign("ARCHIVED")).toBe(false);
  });
});

describe("leaderMayActivateCampaign", () => {
  it("allows platform staff even when the org is unverified", () => {
    expect(
      leaderMayActivateCampaign({
        role: "ADMIN",
        organizationVerifiedAt: null,
      })
    ).toBe(true);
    expect(
      leaderMayActivateCampaign({
        role: "BANK_ADMIN",
        organizationVerifiedAt: null,
      })
    ).toBe(true);
  });

  it("blocks a campaign leader until staff has verified the organization", () => {
    expect(
      leaderMayActivateCampaign({
        role: "CAMPAIGN_LEADER",
        organizationVerifiedAt: null,
      })
    ).toBe(false);
    expect(
      leaderMayActivateCampaign({
        role: "CAMPAIGN_LEADER",
        organizationVerifiedAt: new Date("2026-01-01"),
      })
    ).toBe(true);
  });
});
