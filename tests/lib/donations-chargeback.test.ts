/**
 * @jest-environment node
 *
 * C1: charge.dispute.* money path. In-memory transactional fake — no database.
 * Asserts conditional claims, relative increments, and double-delivery no-ops.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = { $transaction: jest.fn() };
  return { __esModule: true, default: prisma, prisma };
});

import prisma from "@/lib/prisma";
import {
  applyChargeback,
  reinstateChargeback,
  stripeDisputeFeeCents,
} from "@/lib/donations";

type DonationRow = {
  id: string;
  campaignId: string;
  teamMemberId: string | null;
  referralCode: string | null;
  donorId: string | null;
  donorName: string | null;
  donorEmail: string;
  isAnonymous: boolean;
  status: string;
  grossAmount: bigint;
  netAmount: bigint;
  platformFee: bigint;
  processingFee: bigint;
  disputeId: string | null;
  disputedAt: Date | null;
  disputeFee: bigint;
  refundedAmount: bigint;
};

function applyNumeric(
  current: bigint,
  spec: bigint | { increment?: bigint; decrement?: bigint }
): bigint {
  if (typeof spec === "bigint") return spec;
  let next = current;
  if (spec.increment !== undefined) next += spec.increment;
  if (spec.decrement !== undefined) next -= spec.decrement;
  return next;
}

function matchesWhere(
  row: Record<string, unknown>,
  where: Record<string, unknown>
): boolean {
  for (const [key, expected] of Object.entries(where)) {
    const actual = row[key];
    if (
      expected &&
      typeof expected === "object" &&
      !Array.isArray(expected) &&
      "in" in (expected as object)
    ) {
      if (!(expected as { in: unknown[] }).in.includes(actual)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

function seedWorld() {
  const donation: DonationRow = {
    id: "don_1",
    campaignId: "camp_1",
    teamMemberId: "tm_1",
    referralCode: null,
    donorId: "user_donor",
    donorName: "Pat Donor",
    donorEmail: "pat@example.com",
    isAnonymous: false,
    status: "COMPLETED",
    grossAmount: BigInt(10000),
    netAmount: BigInt(8710),
    platformFee: BigInt(1000),
    processingFee: BigInt(320),
    disputeId: null,
    disputedAt: null,
    disputeFee: BigInt(0),
    refundedAmount: BigInt(0),
  };

  const campaign = { id: "camp_1", currentAmount: BigInt(10000) };
  const teamMember = {
    id: "tm_1",
    campaignId: "camp_1",
    deletedAt: null as Date | null,
    amountRaised: BigInt(10000),
  };
  const bankingAccount = {
    id: "ba_1",
    campaignId: "camp_1",
    totalRaised: BigInt(10000),
    availableBalance: BigInt(8710),
    platformFeesCollected: BigInt(1000),
  };
  const transactions: Array<Record<string, unknown>> = [];

  const tx = {
    donation: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        donation.id === where.id ? { ...donation } : null
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          if (!matchesWhere(donation as unknown as Record<string, unknown>, where)) {
            return { count: 0 };
          }
          Object.assign(donation, data);
          return { count: 1 };
        }
      ),
    },
    campaign: {
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { currentAmount: { increment?: bigint; decrement?: bigint } };
        }) => {
          if (campaign.id !== where.id) throw new Error("campaign not found");
          campaign.currentAmount = applyNumeric(
            campaign.currentAmount,
            data.currentAmount
          );
          return { ...campaign };
        }
      ),
    },
    teamMember: {
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: { amountRaised: { increment?: bigint; decrement?: bigint } };
        }) => {
          if (!matchesWhere(teamMember as unknown as Record<string, unknown>, where)) {
            return { count: 0 };
          }
          teamMember.amountRaised = applyNumeric(
            teamMember.amountRaised,
            data.amountRaised
          );
          return { count: 1 };
        }
      ),
    },
    bankingAccount: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { campaignId?: string; id?: string };
        }) => {
          if (where.campaignId && where.campaignId !== bankingAccount.campaignId) {
            return null;
          }
          if (where.id && where.id !== bankingAccount.id) return null;
          return { ...bankingAccount };
        }
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, { increment?: bigint; decrement?: bigint }>;
        }) => {
          if (where.id !== bankingAccount.id) throw new Error("account not found");
          for (const [field, spec] of Object.entries(data)) {
            const account = bankingAccount as unknown as Record<string, bigint>;
            account[field] = applyNumeric(account[field], spec);
          }
          return { ...bankingAccount };
        }
      ),
    },
    transaction: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `txn_${transactions.length + 1}`, ...data };
        transactions.push(row);
        return row;
      }),
      findFirst: jest.fn(async () => null),
    },
  };

  (prisma.$transaction as jest.Mock).mockImplementation(async (fn: Function) =>
    fn(tx)
  );

  return { donation, campaign, teamMember, bankingAccount, transactions, tx };
}

describe("stripeDisputeFeeCents", () => {
  it("sums fee from expanded balance_transactions", () => {
    expect(
      stripeDisputeFeeCents({
        balance_transactions: [
          { fee: 1500 },
          { fee: 0 },
        ],
      })
    ).toBe(BigInt(1500));
  });

  it("ignores unexpanded id strings and returns 0 rather than guessing", () => {
    expect(
      stripeDisputeFeeCents({ balance_transactions: ["txn_abc"] })
    ).toBe(BigInt(0));
  });

  it("returns 0 when Stripe omitted the fee", () => {
    expect(stripeDisputeFeeCents({})).toBe(BigInt(0));
  });
});

describe("applyChargeback", () => {
  it("claims COMPLETED → DISPUTED and reverses gross/net/fee plus the Stripe dispute fee", async () => {
    const world = seedWorld();

    const result = await applyChargeback("don_1", {
      disputeId: "dp_1",
      feeCents: BigInt(1500),
    });

    expect(result?.status).toBe("DISPUTED");
    expect(result?.disputeId).toBe("dp_1");
    expect(world.donation.status).toBe("DISPUTED");
    expect(world.donation.disputeFee).toBe(BigInt(1500));
    expect(world.campaign.currentAmount).toBe(BigInt(0));
    expect(world.teamMember.amountRaised).toBe(BigInt(0));
    expect(world.bankingAccount.totalRaised).toBe(BigInt(0));
    expect(world.bankingAccount.availableBalance).toBe(-BigInt(1500));
    expect(world.bankingAccount.platformFeesCollected).toBe(BigInt(0));

    const types = world.transactions.map((t) => t.type);
    expect(types).toEqual(["CHARGEBACK", "FEE_COLLECTION", "ADJUSTMENT"]);
    expect(world.transactions[0].amount).toBe(-BigInt(8710));
    expect(world.transactions[1].amount).toBe(-BigInt(1000));
    expect(world.transactions[2].amount).toBe(-BigInt(1500));
    expect(world.transactions[2].description).toMatch(/dispute fee/i);
  });

  it("is a no-op on a second delivery of the same dispute (no double debit)", async () => {
    const world = seedWorld();
    await applyChargeback("don_1", { disputeId: "dp_1", feeCents: BigInt(1500) });
    const txs = world.transactions.length;
    const balance = world.bankingAccount.availableBalance;

    const again = await applyChargeback("don_1", {
      disputeId: "dp_1",
      feeCents: BigInt(1500),
    });

    expect(again?.status).toBe("DISPUTED");
    expect(world.transactions.length).toBe(txs);
    expect(world.bankingAccount.availableBalance).toBe(balance);
    expect(world.campaign.currentAmount).toBe(BigInt(0));
  });

  it("does not claim PENDING, FAILED, or REFUNDED donations", async () => {
    for (const status of ["PENDING", "FAILED", "REFUNDED"]) {
      const world = seedWorld();
      world.donation.status = status;
      const result = await applyChargeback("don_1", {
        disputeId: "dp_1",
        feeCents: BigInt(1500),
      });
      expect(result).toBeNull();
      expect(world.campaign.currentAmount).toBe(BigInt(10000));
      expect(world.transactions.length).toBe(0);
    }
  });

  it("omits the ADJUSTMENT row when Stripe reports a zero fee", async () => {
    const world = seedWorld();
    await applyChargeback("don_1", { disputeId: "dp_1", feeCents: BigInt(0) });
    expect(world.transactions.map((t) => t.type)).toEqual([
      "CHARGEBACK",
      "FEE_COLLECTION",
    ]);
    expect(world.bankingAccount.availableBalance).toBe(BigInt(0));
  });
});

describe("reinstateChargeback", () => {
  it("claims DISPUTED → COMPLETED and restores credits including the dispute fee", async () => {
    const world = seedWorld();
    await applyChargeback("don_1", { disputeId: "dp_1", feeCents: BigInt(1500) });

    const result = await reinstateChargeback("don_1");

    expect(result?.status).toBe("COMPLETED");
    expect(world.donation.status).toBe("COMPLETED");
    expect(world.donation.disputeId).toBe("dp_1");
    expect(world.campaign.currentAmount).toBe(BigInt(10000));
    expect(world.teamMember.amountRaised).toBe(BigInt(10000));
    expect(world.bankingAccount.totalRaised).toBe(BigInt(10000));
    expect(world.bankingAccount.availableBalance).toBe(BigInt(8710));
    expect(world.bankingAccount.platformFeesCollected).toBe(BigInt(1000));
  });

  it("is a no-op if the donation is not DISPUTED", async () => {
    const world = seedWorld();
    const result = await reinstateChargeback("don_1");
    expect(result).toBeNull();
    expect(world.campaign.currentAmount).toBe(BigInt(10000));
    expect(world.transactions.length).toBe(0);
  });

  it("is a no-op on a second funds_reinstated / closed-won delivery", async () => {
    const world = seedWorld();
    await applyChargeback("don_1", { disputeId: "dp_1", feeCents: BigInt(1500) });
    await reinstateChargeback("don_1");
    const txs = world.transactions.length;

    const again = await reinstateChargeback("don_1");

    expect(again).toBeNull();
    expect(world.transactions.length).toBe(txs);
    expect(world.campaign.currentAmount).toBe(BigInt(10000));
  });
});
