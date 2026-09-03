/**
 * @jest-environment node
 *
 * H8: staff-recorded offline (cash/check) donations. The critical invariants:
 * zero fees, availableBalance untouched (the platform never holds the money),
 * totals and player attribution still credited, ledger row written.
 * In-memory transactional fake — no database.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = {
    $transaction: jest.fn(),
    campaign: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn() },
  };
  return { __esModule: true, default: prisma, prisma };
});

import prisma from "@/lib/prisma";
import { recordOfflineDonation } from "@/lib/banking";

const findCampaign = prisma.campaign.findUnique as jest.Mock;
const findMember = prisma.teamMember.findFirst as jest.Mock;
const $transaction = prisma.$transaction as jest.Mock;

const BANKING_ID = "bank_1";

function seedWorld() {
  const bankingAccount = {
    id: BANKING_ID,
    totalRaised: BigInt(0),
    platformFeesCollected: BigInt(0),
    availableBalance: BigInt(5000),
  };
  const campaign = {
    id: "camp_1",
    platformFeePercent: 10,
    currentAmount: BigInt(0),
    bankingAccount,
  };
  findCampaign.mockResolvedValue(campaign);

  const created: { donations: any[]; transactions: any[] } = {
    donations: [],
    transactions: [],
  };
  const memberIncrements: any[] = [];

  const tx = {
    donation: {
      create: jest.fn(({ data }: any) => {
        const row = { id: "don_off_1", ...data };
        created.donations.push(row);
        return Promise.resolve(row);
      }),
    },
    bankingAccount: {
      update: jest.fn(({ data }: any) => {
        if (data.totalRaised?.increment !== undefined) {
          bankingAccount.totalRaised += data.totalRaised.increment;
        }
        if (data.availableBalance?.increment !== undefined) {
          bankingAccount.availableBalance += data.availableBalance.increment;
        }
        if (data.platformFeesCollected?.increment !== undefined) {
          bankingAccount.platformFeesCollected +=
            data.platformFeesCollected.increment;
        }
        return Promise.resolve({ ...bankingAccount });
      }),
    },
    transaction: {
      create: jest.fn(({ data }: any) => {
        const row = { id: `txn_${created.transactions.length + 1}`, ...data };
        created.transactions.push(row);
        return Promise.resolve(row);
      }),
    },
    campaign: {
      update: jest.fn(({ data }: any) => {
        if (data.currentAmount?.increment !== undefined) {
          campaign.currentAmount += data.currentAmount.increment;
        }
        return Promise.resolve(campaign);
      }),
    },
    teamMember: {
      updateMany: jest.fn((args: any) => {
        memberIncrements.push(args);
        return Promise.resolve({ count: 1 });
      }),
    },
    referral: { updateMany: jest.fn() },
  };

  $transaction.mockImplementation(async (fn: any) => fn(tx));

  return { bankingAccount, campaign, created, memberIncrements, tx };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("recordOfflineDonation", () => {
  it("records a fee-free COMPLETED donation without touching availableBalance", async () => {
    const world = seedWorld();

    const result = await recordOfflineDonation({
      campaignId: "camp_1",
      recordedByUserId: "staff_1",
      grossAmount: 2500,
      method: "CASH",
      donorName: "Bake Sale",
    });

    const donation = world.created.donations[0];
    expect(donation.status).toBe("COMPLETED");
    expect(donation.paymentMethod).toBe("CASH");
    expect(donation.grossAmount).toBe(BigInt(2500));
    expect(donation.platformFee).toBe(BigInt(0));
    expect(donation.processingFee).toBe(BigInt(0));
    expect(donation.netAmount).toBe(BigInt(2500));

    // Money the platform never held must not become disbursable.
    expect(world.bankingAccount.availableBalance).toBe(BigInt(5000));
    expect(world.bankingAccount.totalRaised).toBe(BigInt(2500));
    expect(world.campaign.currentAmount).toBe(BigInt(2500));

    // Ledger row exists, balanceAfter reflects the UNCHANGED balance.
    expect(world.created.transactions).toHaveLength(1);
    expect(world.created.transactions[0].type).toBe("DEPOSIT");
    expect(world.created.transactions[0].balanceAfter).toBe(BigInt(5000));
    expect(world.created.transactions[0].createdBy).toBe("staff_1");

    expect(result.donation.id).toBe("don_off_1");
  });

  it("credits the attributed player and includes the check reference", async () => {
    const world = seedWorld();
    findMember.mockResolvedValue({ id: "tm_1" });

    await recordOfflineDonation({
      campaignId: "camp_1",
      recordedByUserId: "staff_1",
      grossAmount: 10000,
      method: "CHECK",
      teamMemberId: "tm_1",
      reference: "check #204",
    });

    expect(world.memberIncrements).toHaveLength(1);
    expect(world.memberIncrements[0].where.id).toBe("tm_1");
    expect(world.memberIncrements[0].data.amountRaised.increment).toBe(
      BigInt(10000)
    );
    expect(world.created.transactions[0].description).toContain("check #204");
  });

  it("rejects an unresolvable team member instead of dropping attribution", async () => {
    seedWorld();
    findMember.mockResolvedValue(null);

    await expect(
      recordOfflineDonation({
        campaignId: "camp_1",
        recordedByUserId: "staff_1",
        grossAmount: 1000,
        method: "CASH",
        teamMemberId: "tm_ghost",
      })
    ).rejects.toThrow("Team member not found on this campaign");
  });

  it("rejects non-positive amounts", async () => {
    seedWorld();
    await expect(
      recordOfflineDonation({
        campaignId: "camp_1",
        recordedByUserId: "staff_1",
        grossAmount: 0,
        method: "CASH",
      })
    ).rejects.toThrow("must be positive");
  });
});
