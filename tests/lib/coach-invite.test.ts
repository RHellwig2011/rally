/**
 * @jest-environment node
 *
 * Assistant-coach invite authorization + one-time accept claim.
 * In-memory prisma fake — no database.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = {
    campaign: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    coachInvite: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return { __esModule: true, default: prisma, prisma };
});

jest.mock("@/lib/email", () => ({
  sendCoachInviteEmail: jest.fn().mockResolvedValue(undefined),
  sendAssistantCoachAddedEmail: jest.fn().mockResolvedValue(undefined),
}));

import prisma from "@/lib/prisma";
import {
  canInviteAssistantCoach,
  claimCoachInvite,
  inviteAssistantCoach,
} from "@/lib/coach-invite";

const updateMany = prisma.coachInvite.updateMany as jest.Mock;
const findUniqueInvite = prisma.coachInvite.findUnique as jest.Mock;
const campaignUpdate = prisma.campaign.update as jest.Mock;
const campaignFindUnique = prisma.campaign.findUnique as jest.Mock;
const userFindUnique = prisma.user.findUnique as jest.Mock;
const inviteCreate = prisma.coachInvite.create as jest.Mock;
const inviteFindFirst = prisma.coachInvite.findFirst as jest.Mock;

type InviteRow = {
  token: string;
  campaignId: string;
  acceptedAt: Date | null;
  expiresAt: Date;
};

function matchesInvite(row: InviteRow, where: Record<string, unknown>): boolean {
  if (where.token !== undefined && row.token !== where.token) return false;
  if (where.acceptedAt === null && row.acceptedAt !== null) return false;
  const expires = where.expiresAt as { gt?: Date } | undefined;
  if (expires?.gt && row.expiresAt.getTime() <= expires.gt.getTime()) return false;
  return true;
}

function useInvites(rows: InviteRow[]): InviteRow[] {
  updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      let count = 0;
      for (const row of rows) {
        if (!matchesInvite(row, where)) continue;
        Object.assign(row, data);
        count++;
      }
      return { count };
    }
  );
  findUniqueInvite.mockImplementation(
    async ({ where }: { where: { token: string } }) =>
      rows.find((row) => row.token === where.token) ?? null
  );
  campaignUpdate.mockResolvedValue({});
  return rows;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("canInviteAssistantCoach", () => {
  it("allows the primary leader", () => {
    expect(
      canInviteAssistantCoach(
        { id: "leader", role: "CAMPAIGN_LEADER" },
        { primaryLeaderId: "leader" }
      )
    ).toBe(true);
  });

  it("allows ADMIN", () => {
    expect(
      canInviteAssistantCoach(
        { id: "admin", role: "ADMIN" },
        { primaryLeaderId: "leader" }
      )
    ).toBe(true);
  });

  it("rejects a guardian", () => {
    expect(
      canInviteAssistantCoach(
        { id: "g1", role: "GUARDIAN" },
        { primaryLeaderId: "leader" }
      )
    ).toBe(false);
  });
});

describe("inviteAssistantCoach", () => {
  const campaign = {
    id: "c1",
    organizationName: "Lincoln",
    teamName: "Football",
    primaryLeaderId: "leader",
    primaryLeader: {
      id: "leader",
      email: "leader@example.com",
      firstName: "Pat",
      lastName: "Coach",
    },
    guardians: [{ id: "g1", email: "guardian@example.com" }],
  };

  it("guardian cannot invite", async () => {
    campaignFindUnique.mockResolvedValue(campaign);

    const result = await inviteAssistantCoach({
      campaignId: "c1",
      email: "new@example.com",
      actor: { id: "g1", role: "GUARDIAN" },
      actorName: "Guardian",
    });

    expect(result).toEqual({
      ok: false,
      error: "Not authorized to invite assistant coaches",
      httpStatus: 403,
    });
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(inviteCreate).not.toHaveBeenCalled();
    expect(campaignUpdate).not.toHaveBeenCalled();
  });

  it("leader can invite a new email", async () => {
    campaignFindUnique.mockResolvedValue(campaign);
    userFindUnique.mockResolvedValue(null);
    inviteFindFirst.mockResolvedValue(null);
    inviteCreate.mockResolvedValue({ id: "inv1" });

    const result = await inviteAssistantCoach({
      campaignId: "c1",
      email: "new@example.com",
      actor: { id: "leader", role: "CAMPAIGN_LEADER" },
      actorName: "Pat Coach",
    });

    expect(result).toEqual({ ok: true, status: "invited" });
    expect(inviteCreate).toHaveBeenCalled();
  });
});

describe("claimCoachInvite", () => {
  it("claims once and connects the user as a guardian", async () => {
    const rows = useInvites([
      {
        token: "tok_live",
        campaignId: "c1",
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    const first = await claimCoachInvite({ token: "tok_live", userId: "u1" });
    const second = await claimCoachInvite({ token: "tok_live", userId: "u2" });

    expect(first).toBe("claimed");
    expect(second).toBe("not_claimed");
    expect(rows[0].acceptedAt).not.toBeNull();
    expect(campaignUpdate).toHaveBeenCalledTimes(1);
    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { guardians: { connect: { id: "u1" } } },
    });
  });

  it("does not claim an expired invite", async () => {
    useInvites([
      {
        token: "tok_old",
        campaignId: "c1",
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);

    await expect(
      claimCoachInvite({ token: "tok_old", userId: "u1" })
    ).resolves.toBe("not_claimed");
    expect(campaignUpdate).not.toHaveBeenCalled();
  });
});
