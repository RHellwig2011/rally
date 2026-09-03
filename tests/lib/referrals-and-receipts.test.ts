/**
 * @jest-environment node
 *
 * H12/H4: referral row minting (ensureReferral) and receipt tax identity
 * (getReceiptTaxIdentity). In-memory prisma fakes — no database.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = {
    referral: { findFirst: jest.fn(), create: jest.fn() },
    campaign: { findUnique: jest.fn() },
  };
  return { __esModule: true, default: prisma, prisma };
});

import prisma from "@/lib/prisma";
import { ensureReferral, generateReferralCode } from "@/lib/referrals";
import { getReceiptTaxIdentity } from "@/lib/receipts";

const referralFindFirst = prisma.referral.findFirst as jest.Mock;
const referralCreate = prisma.referral.create as jest.Mock;
const campaignFindUnique = prisma.campaign.findUnique as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateReferralCode", () => {
  it("produces distinct URL-safe codes", () => {
    const codes = new Set(
      Array.from({ length: 50 }, () => generateReferralCode())
    );
    expect(codes.size).toBe(50);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(code.length).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("ensureReferral", () => {
  it("returns the existing row without creating a second one", async () => {
    referralFindFirst.mockResolvedValue({ id: "r1", referralCode: "abc" });

    const result = await ensureReferral("camp1", "user1");

    expect(result).toEqual({ id: "r1", referralCode: "abc" });
    expect(referralCreate).not.toHaveBeenCalled();
  });

  it("creates a new row scoped to the campaign and referrer", async () => {
    referralFindFirst.mockResolvedValue(null);
    referralCreate.mockImplementation(({ data }) =>
      Promise.resolve({ id: "r-new", referralCode: data.referralCode })
    );

    const result = await ensureReferral("camp1", "user1");

    expect(result?.id).toBe("r-new");
    const args = referralCreate.mock.calls[0][0];
    expect(args.data.campaignId).toBe("camp1");
    expect(args.data.referrerId).toBe("user1");
    expect(args.data.referralCode).toEqual(expect.any(String));
  });

  it("returns the concurrent winner's row on a P2002 race", async () => {
    const { Prisma } = jest.requireActual("@prisma/client");
    const p2002 = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002",
      clientVersion: "test",
    });

    referralFindFirst
      .mockResolvedValueOnce(null) // initial existence check
      .mockResolvedValueOnce({ id: "r-won", referralCode: "winner" }); // after P2002
    referralCreate.mockRejectedValue(p2002);

    const result = await ensureReferral("camp1", "user1");

    expect(result).toEqual({ id: "r-won", referralCode: "winner" });
  });

  it("degrades to null instead of throwing on unexpected failure", async () => {
    referralFindFirst.mockRejectedValue(new Error("db down"));

    await expect(ensureReferral("camp1", "user1")).resolves.toBeNull();
  });
});

describe("getReceiptTaxIdentity", () => {
  it("claims deductibility only with the full verified identity", async () => {
    campaignFindUnique.mockResolvedValue({
      program: {
        isTaxExempt: true,
        legalName: "Lincoln Boosters Inc",
        ein: "12-3456789",
      },
    });

    await expect(getReceiptTaxIdentity("camp1")).resolves.toEqual({
      taxDeductible: true,
      orgLegalName: "Lincoln Boosters Inc",
      ein: "12-3456789",
    });
  });

  it.each([
    ["not tax exempt", { isTaxExempt: false, legalName: "X", ein: "12-3456789" }],
    ["missing legal name", { isTaxExempt: true, legalName: null, ein: "12-3456789" }],
    ["missing EIN", { isTaxExempt: true, legalName: "X", ein: null }],
  ])("refuses the claim when %s", async (_label, program) => {
    campaignFindUnique.mockResolvedValue({ program });

    await expect(getReceiptTaxIdentity("camp1")).resolves.toEqual({
      taxDeductible: false,
      orgLegalName: null,
      ein: null,
    });
  });

  it("refuses the claim for a campaign with no program", async () => {
    campaignFindUnique.mockResolvedValue({ program: null });
    await expect(getReceiptTaxIdentity("camp1")).resolves.toMatchObject({
      taxDeductible: false,
    });
  });

  it("degrades safely when the lookup fails", async () => {
    campaignFindUnique.mockRejectedValue(new Error("db down"));
    await expect(getReceiptTaxIdentity("camp1")).resolves.toMatchObject({
      taxDeductible: false,
    });
  });
});
