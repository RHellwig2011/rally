/**
 * @jest-environment node
 *
 * C4/H14: onboarding invitation tokens — issue, expiry, rotation policy, and
 * the one-time conditional claim that links a TeamMember to a User.
 * In-memory prisma fake — no database.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = { teamMember: { updateMany: jest.fn() } };
  return { __esModule: true, default: prisma, prisma };
});

import prisma from "@/lib/prisma";
import {
  INVITATION_TOKEN_TTL_MS,
  generateInvitationToken,
  invitationTokenExpiry,
  isInvitationTokenExpired,
  buildOnboardingLink,
  claimTeamMemberOnboarding,
} from "@/lib/onboarding";

const updateMany = prisma.teamMember.updateMany as jest.Mock;

type Row = {
  id: string;
  invitationToken: string | null;
  invitationTokenExpiresAt: Date | null;
  onboardingCompletedAt: Date | null;
  userId: string | null;
  deletedAt: Date | null;
  invitationStatus: string;
  joinedAt: Date | null;
  [key: string]: unknown;
};

function matches(row: Row, where: Record<string, unknown>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    const value = row[key];
    if (cond === null) {
      if (value !== null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const range = cond as { gt?: Date };
      if (range.gt !== undefined) {
        if (!(value instanceof Date) || value.getTime() <= range.gt.getTime()) {
          return false;
        }
        continue;
      }
      return false;
    }
    if (value !== cond) return false;
  }
  return true;
}

/** Wire updateMany to an in-memory row set, mimicking the conditional claim. */
function useRows(rows: Row[]): Row[] {
  updateMany.mockImplementation(
    async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      let count = 0;
      for (const row of rows) {
        if (!matches(row, where)) continue;
        count++;
        Object.assign(row, data);
      }
      return { count };
    }
  );
  return rows;
}

function pendingRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "tm_1",
    invitationToken: "tok_live",
    invitationTokenExpiresAt: new Date(Date.now() + 60_000),
    onboardingCompletedAt: null,
    userId: null,
    deletedAt: null,
    invitationStatus: "PENDING",
    joinedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  updateMany.mockReset();
});

describe("generateInvitationToken", () => {
  it("returns a 64-char hex string (32 random bytes)", () => {
    const token = generateInvitationToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never repeats across calls", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateInvitationToken())
    );
    expect(tokens.size).toBe(100);
  });
});

describe("invitationTokenExpiry", () => {
  it("defaults to 14 days from now", () => {
    const before = Date.now();
    const expiry = invitationTokenExpiry();
    const after = Date.now();
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + INVITATION_TOKEN_TTL_MS);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + INVITATION_TOKEN_TTL_MS);
    expect(INVITATION_TOKEN_TTL_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it("is anchored to the provided start time", () => {
    const start = new Date("2026-09-01T00:00:00Z");
    expect(invitationTokenExpiry(start).toISOString()).toBe(
      "2026-09-15T00:00:00.000Z"
    );
  });
});

describe("isInvitationTokenExpired", () => {
  const now = new Date("2026-09-03T12:00:00Z");

  it("fails closed on a null expiry", () => {
    expect(isInvitationTokenExpired({ invitationTokenExpiresAt: null }, now)).toBe(true);
  });

  it("treats a past expiry as expired", () => {
    expect(
      isInvitationTokenExpired(
        { invitationTokenExpiresAt: new Date("2026-09-03T11:59:59Z") },
        now
      )
    ).toBe(true);
  });

  it("treats the exact expiry instant as expired", () => {
    expect(
      isInvitationTokenExpired({ invitationTokenExpiresAt: now }, now)
    ).toBe(true);
  });

  it("treats a future expiry as live", () => {
    expect(
      isInvitationTokenExpired(
        { invitationTokenExpiresAt: new Date("2026-09-03T12:00:01Z") },
        now
      )
    ).toBe(false);
  });
});

describe("buildOnboardingLink", () => {
  it("builds the /player/onboard URL with the token", () => {
    expect(buildOnboardingLink("tm_1", "abc123")).toBe(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/player/onboard/tm_1?token=abc123`
    );
  });
});

describe("claimTeamMemberOnboarding", () => {
  it("claims: links the user, clears token + expiry, marks ACCEPTED", async () => {
    const [row] = useRows([pendingRow()]);

    const result = await claimTeamMemberOnboarding({
      teamMemberId: "tm_1",
      invitationToken: "tok_live",
      userId: "user_1",
      profileData: { parentFirstName: "Pat" },
    });

    expect(result).toBe("claimed");
    expect(row.userId).toBe("user_1");
    expect(row.invitationToken).toBeNull();
    expect(row.invitationTokenExpiresAt).toBeNull();
    expect(row.invitationStatus).toBe("ACCEPTED");
    expect(row.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(row.joinedAt).toBeInstanceOf(Date);
    expect(row.parentFirstName).toBe("Pat");
  });

  it("never overwrites an existing userId link", async () => {
    const [row] = useRows([pendingRow({ userId: "user_original" })]);

    const result = await claimTeamMemberOnboarding({
      teamMemberId: "tm_1",
      invitationToken: "tok_live",
      userId: "user_attacker",
      profileData: {},
    });

    expect(result).toBe("not_claimed");
    expect(row.userId).toBe("user_original");
    expect(row.invitationToken).toBe("tok_live");
  });

  it("rejects an expired token at the write, not just at the read", async () => {
    const [row] = useRows([
      pendingRow({ invitationTokenExpiresAt: new Date(Date.now() - 1_000) }),
    ]);

    const result = await claimTeamMemberOnboarding({
      teamMemberId: "tm_1",
      invitationToken: "tok_live",
      userId: "user_1",
      profileData: {},
    });

    expect(result).toBe("not_claimed");
    expect(row.userId).toBeNull();
    expect(row.invitationToken).toBe("tok_live");
  });

  it("rejects a wrong token", async () => {
    const [row] = useRows([pendingRow()]);

    const result = await claimTeamMemberOnboarding({
      teamMemberId: "tm_1",
      invitationToken: "tok_wrong",
      userId: "user_1",
      profileData: {},
    });

    expect(result).toBe("not_claimed");
    expect(row.userId).toBeNull();
  });

  it("rejects a member whose onboarding already completed", async () => {
    const [row] = useRows([
      pendingRow({ onboardingCompletedAt: new Date(), invitationToken: null }),
    ]);

    const result = await claimTeamMemberOnboarding({
      teamMemberId: "tm_1",
      invitationToken: "tok_live",
      userId: "user_1",
      profileData: {},
    });

    expect(result).toBe("not_claimed");
    expect(row.userId).toBeNull();
  });

  it("claims without a user when the member has no account to link", async () => {
    const [row] = useRows([pendingRow()]);

    const result = await claimTeamMemberOnboarding({
      teamMemberId: "tm_1",
      invitationToken: "tok_live",
      userId: null,
      profileData: {},
    });

    expect(result).toBe("claimed");
    expect(row.userId).toBeNull();
    expect(row.invitationStatus).toBe("ACCEPTED");
  });

  it("concurrent double claim: exactly one winner, token is spent", async () => {
    const [row] = useRows([pendingRow()]);

    // Both requests pass their pre-claim reads, then race the updateMany.
    const [first, second] = await Promise.all([
      claimTeamMemberOnboarding({
        teamMemberId: "tm_1",
        invitationToken: "tok_live",
        userId: "user_a",
        profileData: {},
      }),
      claimTeamMemberOnboarding({
        teamMemberId: "tm_1",
        invitationToken: "tok_live",
        userId: "user_b",
        profileData: {},
      }),
    ]);

    expect([first, second].sort()).toEqual(["claimed", "not_claimed"]);
    expect(row.userId).toBe("user_a");
    expect(row.invitationToken).toBeNull();
  });
});
