/**
 * @jest-environment node
 *
 * H1: cumulative / partial refunds. In-memory transactional fake — no database.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = { $transaction: jest.fn() };
  return { __esModule: true, default: prisma, prisma };
});

import prisma from "@/lib/prisma";
import {
  applyChargeback,
  applyRefund,
  chargeRefundToGross,
  refundDonation,
  reinstateChargeback,
} from "@/lib/donations";

const ZERO = BigInt(0);
const GROSS = BigInt(10000);
const NET = BigInt(8710);
const FEE = BigInt(1000);

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
  refundedAmount: bigint;
  disputeId: string | null;
  disputedAt: Date | null;
  disputeFee: bigint;
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

function seedWorld(overrides: Partial<DonationRow> = {}) {
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
    grossAmount: GROSS,
    netAmount: NET,
    platformFee: FEE,
    processingFee: BigInt(320),
    refundedAmount: ZERO,
    disputeId: null,
    disputedAt: null,
    disputeFee: ZERO,
    ...overrides,
  };

  const campaign = { id: "camp_1", currentAmount: GROSS };
  const teamMember = {
    id: "tm_1",
    campaignId: "camp_1",
    deletedAt: null as Date | null,
    amountRaised: GROSS,
  };
  const bankingAccount = {
    id: "ba_1",
    campaignId: "camp_1",
    totalRaised: GROSS,
    availableBalance: NET,
    platformFeesCollected: FEE,
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
          const account = bankingAccount as unknown as Record<string, bigint>;
          for (const [field, spec] of Object.entries(data)) {
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

describe("chargeRefundToGross", () => {
  it("maps a full Stripe refund onto donation.grossAmount (coverFees charge > gross)", () => {
    expect(
      chargeRefundToGross(BigInt(10320), BigInt(10320), GROSS)
    ).toBe(GROSS);
  });

  it("maps a half Stripe refund proportionally onto gross", () => {
    expect(
      chargeRefundToGross(BigInt(5160), BigInt(10320), GROSS)
    ).toBe(BigInt(5000));
  });

  it("returns 0 when charge amount is 0", () => {
    expect(chargeRefundToGross(BigInt(1), ZERO, GROSS)).toBe(ZERO);
  });
});

describe("applyRefund", () => {
  it("full refund claims COMPLETED → REFUNDED and reverses gross/net/platform fee", async () => {
    const world = seedWorld();
    const result = await applyRefund("don_1", GROSS);

    expect(result?.status).toBe("REFUNDED");
    expect(world.donation.refundedAmount).toBe(GROSS);
    expect(world.campaign.currentAmount).toBe(ZERO);
    expect(world.teamMember.amountRaised).toBe(ZERO);
    expect(world.bankingAccount.totalRaised).toBe(ZERO);
    expect(world.bankingAccount.availableBalance).toBe(ZERO);
    expect(world.bankingAccount.platformFeesCollected).toBe(ZERO);
    expect(world.transactions.map((t) => t.type)).toEqual([
      "REFUND",
      "FEE_COLLECTION",
    ]);
    expect(world.transactions[0].amount).toBe(-NET);
    expect(world.transactions[1].amount).toBe(-FEE);
  });

  it("refundDonation() still fully refunds (wrapper)", async () => {
    const world = seedWorld();
    const result = await refundDonation("don_1");
    expect(result?.status).toBe("REFUNDED");
    expect(world.campaign.currentAmount).toBe(ZERO);
    expect(world.bankingAccount.availableBalance).toBe(ZERO);
  });

  it("applies a 50% refund, keeps COMPLETED, and reverses the proportional slice", async () => {
    const world = seedWorld();
    const result = await applyRefund("don_1", BigInt(5000));

    expect(result?.status).toBe("COMPLETED");
    expect(world.donation.refundedAmount).toBe(BigInt(5000));
    expect(world.campaign.currentAmount).toBe(BigInt(5000));
    expect(world.teamMember.amountRaised).toBe(BigInt(5000));
    expect(world.bankingAccount.totalRaised).toBe(BigInt(5000));
    expect(world.bankingAccount.availableBalance).toBe(BigInt(4355));
    expect(world.bankingAccount.platformFeesCollected).toBe(BigInt(500));
    expect(world.transactions[0].amount).toBe(-BigInt(4355));
    expect(world.transactions[1].amount).toBe(-BigInt(500));
  });

  it("is a no-op on a second delivery of the same cumulative amount", async () => {
    const world = seedWorld();
    await applyRefund("don_1", BigInt(5000));
    const txs = world.transactions.length;
    const balance = world.bankingAccount.availableBalance;

    const again = await applyRefund("don_1", BigInt(5000));

    expect(again?.refundedAmount).toBe(BigInt(5000));
    expect(world.transactions.length).toBe(txs);
    expect(world.bankingAccount.availableBalance).toBe(balance);
  });

  it("a later full refund reverses only the remainder (no double debit)", async () => {
    const world = seedWorld();
    await applyRefund("don_1", BigInt(5000));
    const result = await applyRefund("don_1", GROSS);

    expect(result?.status).toBe("REFUNDED");
    expect(world.donation.refundedAmount).toBe(GROSS);
    expect(world.campaign.currentAmount).toBe(ZERO);
    expect(world.bankingAccount.availableBalance).toBe(ZERO);
    expect(world.bankingAccount.platformFeesCollected).toBe(ZERO);
    expect(world.transactions).toHaveLength(4);
    expect(world.transactions[2].amount).toBe(-BigInt(4355));
    expect(world.transactions[3].amount).toBe(-BigInt(500));
  });

  it("does not claim PENDING, FAILED, or DISPUTED donations", async () => {
    for (const status of ["PENDING", "FAILED", "DISPUTED"]) {
      const world = seedWorld({ status });
      const result = await applyRefund("don_1", GROSS);
      expect(result).toBeNull();
      expect(world.campaign.currentAmount).toBe(GROSS);
      expect(world.transactions.length).toBe(0);
    }
  });

  it("pushes leftover cents on the final refund so books close at zero", async () => {
    const world = seedWorld({
      grossAmount: BigInt(10001),
      netAmount: BigInt(8710),
    });
    world.campaign.currentAmount = BigInt(10001);
    world.teamMember.amountRaised = BigInt(10001);
    world.bankingAccount.totalRaised = BigInt(10001);

    await applyRefund("don_1", BigInt(5000));
    await applyRefund("don_1", BigInt(10001));

    expect(world.donation.status).toBe("REFUNDED");
    expect(world.campaign.currentAmount).toBe(ZERO);
    expect(world.bankingAccount.availableBalance).toBe(ZERO);
    expect(world.bankingAccount.platformFeesCollected).toBe(ZERO);
  });
});

describe("applyChargeback after a partial refund", () => {
  it("reverses only the remaining credit, not the original full amounts", async () => {
    const world = seedWorld();
    await applyRefund("don_1", BigInt(5000));

    await applyChargeback("don_1", { disputeId: "dp_1", feeCents: BigInt(1500) });

    expect(world.donation.status).toBe("DISPUTED");
    expect(world.campaign.currentAmount).toBe(ZERO);
    expect(world.teamMember.amountRaised).toBe(ZERO);
    expect(world.bankingAccount.totalRaised).toBe(ZERO);
    expect(world.bankingAccount.availableBalance).toBe(-BigInt(1500));
    expect(world.bankingAccount.platformFeesCollected).toBe(ZERO);
  });

  it("reinstate restores only the chargebacked remainder; the refund stays reversed", async () => {
    const world = seedWorld();
    await applyRefund("don_1", BigInt(5000));
    await applyChargeback("don_1", { disputeId: "dp_1", feeCents: BigInt(1500) });

    await reinstateChargeback("don_1");

    expect(world.donation.status).toBe("COMPLETED");
    expect(world.donation.refundedAmount).toBe(BigInt(5000));
    expect(world.campaign.currentAmount).toBe(BigInt(5000));
    expect(world.bankingAccount.availableBalance).toBe(BigInt(4355));
    expect(world.bankingAccount.platformFeesCollected).toBe(BigInt(500));
  });
});
