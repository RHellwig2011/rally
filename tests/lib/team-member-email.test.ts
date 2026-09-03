/**
 * @jest-environment node
 */

import {
  decideTeamMemberEmailChange,
  normalizeTeamMemberEmail,
} from "@/lib/utils/team-member-email";
import { isLegacyRosterImportEnabled } from "@/lib/utils/legacy-roster-import";
import { updateTeamMemberSchema } from "@/lib/validations/team-member";

describe("normalizeTeamMemberEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeTeamMemberEmail("  Alex@Team.ORG  ")).toBe("alex@team.org");
  });
});

describe("decideTeamMemberEmailChange", () => {
  it("is a no-op when the address is unchanged (case-insensitive)", () => {
    expect(
      decideTeamMemberEmailChange({
        currentEmail: "alex@team.org",
        requestedEmail: "Alex@Team.ORG",
        hasLiveConflict: false,
      })
    ).toEqual({ type: "unchanged" });
  });

  it("does not treat a live self-match as a conflict", () => {
    // The handler excludes the current row when probing for a live clash.
    expect(
      decideTeamMemberEmailChange({
        currentEmail: "alex@team.org",
        requestedEmail: "alex@team.org",
        hasLiveConflict: true,
      })
    ).toEqual({ type: "unchanged" });
  });

  it("updates in place when no live row holds the new address", () => {
    expect(
      decideTeamMemberEmailChange({
        currentEmail: "old@team.org",
        requestedEmail: " New@Team.ORG ",
        hasLiveConflict: false,
      })
    ).toEqual({ type: "update", email: "new@team.org" });
  });

  it("conflicts when another live row already has that email", () => {
    expect(
      decideTeamMemberEmailChange({
        currentEmail: "old@team.org",
        requestedEmail: "taken@team.org",
        hasLiveConflict: true,
      })
    ).toEqual({ type: "conflict" });
  });

  it("allows the write when the only clash is a removed player (not a live conflict)", () => {
    // Partial unique index: (campaignId, email) WHERE deletedAt IS NULL.
    expect(
      decideTeamMemberEmailChange({
        currentEmail: "old@team.org",
        requestedEmail: "alumni@team.org",
        hasLiveConflict: false,
      })
    ).toEqual({ type: "update", email: "alumni@team.org" });
  });

  it("does not blank an existing email", () => {
    expect(
      decideTeamMemberEmailChange({
        currentEmail: "alex@team.org",
        requestedEmail: "   ",
        hasLiveConflict: false,
      })
    ).toEqual({ type: "unchanged" });
  });
});

describe("updateTeamMemberSchema email", () => {
  it("accepts and normalizes an in-place email change", () => {
    const parsed = updateTeamMemberSchema.parse({
      email: "  New.Address@Example.COM ",
    });
    expect(parsed.email).toBe("new.address@example.com");
  });

  it("rejects an invalid email", () => {
    expect(() =>
      updateTeamMemberSchema.parse({ email: "not-an-email" })
    ).toThrow("Invalid email format");
  });
});

describe("isLegacyRosterImportEnabled", () => {
  it("is off by default", () => {
    expect(isLegacyRosterImportEnabled({})).toBe(false);
  });

  it("is off for empty or falsey values", () => {
    expect(isLegacyRosterImportEnabled({ ALLOW_LEGACY_ROSTER_IMPORT: "" })).toBe(
      false
    );
    expect(
      isLegacyRosterImportEnabled({ ALLOW_LEGACY_ROSTER_IMPORT: "false" })
    ).toBe(false);
    expect(
      isLegacyRosterImportEnabled({ ALLOW_LEGACY_ROSTER_IMPORT: "1" })
    ).toBe(false);
  });

  it("is on only when the flag is the string true", () => {
    expect(
      isLegacyRosterImportEnabled({ ALLOW_LEGACY_ROSTER_IMPORT: "true" })
    ).toBe(true);
  });
});
