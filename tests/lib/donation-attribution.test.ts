/**
 * @jest-environment node
 *
 * M4: a caller-supplied teamMemberId that does not resolve must reject, not
 * silently donate to the campaign with no player credit.
 */

import {
  decideTeamMemberAttribution,
  teamMemberAttributionWhere,
} from "@/lib/donation-attribution";

describe("decideTeamMemberAttribution", () => {
  it("omits attribution when the client did not send a teamMemberId", () => {
    expect(decideTeamMemberAttribution(undefined, undefined)).toEqual({
      status: "omit",
    });
    expect(decideTeamMemberAttribution("", null)).toEqual({ status: "omit" });
    expect(decideTeamMemberAttribution("   ", undefined)).toEqual({
      status: "omit",
    });
  });

  it("uses the resolved row id when the identifier matches", () => {
    expect(decideTeamMemberAttribution("jessicarib53z", "tm_real")).toEqual({
      status: "use",
      teamMemberId: "tm_real",
    });
  });

  it("rejects when an identifier was sent but no live member on this campaign matched", () => {
    expect(decideTeamMemberAttribution("tm_unknown", undefined)).toEqual({
      status: "reject",
    });
    expect(decideTeamMemberAttribution("tm_unknown", null)).toEqual({
      status: "reject",
    });
  });
});

describe("teamMemberAttributionWhere", () => {
  it("resolves by cuid or fundLinkCode, scoped to the campaign and live rows", () => {
    expect(teamMemberAttributionWhere("camp_1", "jessicarib53z")).toEqual({
      campaignId: "camp_1",
      deletedAt: null,
      OR: [{ id: "jessicarib53z" }, { fundLinkCode: "jessicarib53z" }],
    });
  });
});
