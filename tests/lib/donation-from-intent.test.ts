/**
 * @jest-environment node
 *
 * H10: webhook fallback must not treat a coverFees charge as gross, and must
 * carry teamMemberId through PaymentIntent metadata.
 */

import {
  calculateDonationFees,
  reconstructDonationFromIntent,
} from "@/lib/banking";

describe("reconstructDonationFromIntent", () => {
  it("uses the charged amount as gross when the donor did not cover fees", () => {
    const result = reconstructDonationFromIntent({
      amount: 10000,
      metadata: {
        campaignId: "camp_1",
        donorEmail: "a@b.com",
      },
    });
    expect(result.grossAmount).toBe(BigInt(10000));
    expect(result.coverFees).toBe(false);
    expect(result.teamMemberId).toBeUndefined();
  });

  it("prefers metadata.grossAmount over the charged amount", () => {
    const result = reconstructDonationFromIntent({
      amount: 10320,
      metadata: {
        coverFees: "true",
        grossAmount: "10000",
        teamMemberId: "tm_1",
        campaignId: "camp_1",
        donorEmail: "a@b.com",
        donorName: "Pat",
        referralCode: "abc",
      },
    });
    expect(result.grossAmount).toBe(BigInt(10000));
    expect(result.coverFees).toBe(true);
    expect(result.teamMemberId).toBe("tm_1");
    expect(result.referralCode).toBe("abc");
    expect(result.donorName).toBe("Pat");
  });

  it("inverts coverFees charged amount when grossAmount metadata is absent", () => {
    const gross = 10000;
    const charged = gross + Math.round(gross * 0.029) + 30;
    expect(charged).toBe(10320);

    const result = reconstructDonationFromIntent({
      amount: charged,
      metadata: { coverFees: "true", campaignId: "camp_1", donorEmail: "a@b.com" },
    });
    expect(result.grossAmount).toBe(BigInt(10000));
    expect(result.coverFees).toBe(true);
  });

  it("inverts a range of coverFees gifts without rounding drift", () => {
    for (const gross of [100, 250, 999, 1000, 5000, 12345, 99999]) {
      const charged = gross + Math.round(gross * 0.029) + 30;
      const result = reconstructDonationFromIntent({
        amount: charged,
        metadata: { coverFees: "true" },
      });
      expect(result.grossAmount).toBe(BigInt(gross));
    }
  });

  it("ignores empty teamMemberId metadata", () => {
    const result = reconstructDonationFromIntent({
      amount: 10000,
      metadata: { teamMemberId: "" },
    });
    expect(result.teamMemberId).toBeUndefined();
  });
});

describe("calculateDonationFees coverFees", () => {
  it("does not subtract processing from net when the donor covered fees", () => {
    const covered = calculateDonationFees(BigInt(10000), 10, true);
    const notCovered = calculateDonationFees(BigInt(10000), 10, false);

    expect(covered.platformFee).toBe(notCovered.platformFee);
    expect(covered.processingFee).toBe(notCovered.processingFee);
    expect(covered.netAmount).toBe(covered.grossAmount - covered.platformFee);
    expect(notCovered.netAmount).toBe(
      notCovered.grossAmount - notCovered.platformFee - notCovered.processingFee
    );
  });
});
