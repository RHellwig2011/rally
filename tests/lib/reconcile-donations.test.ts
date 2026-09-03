/**
 * @jest-environment node
 *
 * H2: stranded PENDING donation reconciler. Pure action matrix + orchestrator
 * with injected Stripe/prisma mocks — no database, no network.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = {
    donation: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  return { __esModule: true, default: prisma, prisma };
});

jest.mock("@/lib/stripe", () => ({
  retrievePaymentIntent: jest.fn(),
}));

jest.mock("@/lib/donations", () => ({
  completeDonation: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { retrievePaymentIntent } from "@/lib/stripe";
import { completeDonation } from "@/lib/donations";
import {
  pendingReconcileAction,
  reconcilePendingDonations,
} from "@/lib/reconcile-donations";

describe("pendingReconcileAction", () => {
  const stripePending = {
    paymentIntentId: "pi_1",
    paymentProvider: "STRIPE" as const,
  };

  it("completes when Stripe reports succeeded", () => {
    expect(pendingReconcileAction(stripePending, { status: "succeeded" })).toBe(
      "complete"
    );
  });

  it("expires canceled and requires_payment_method intents", () => {
    expect(pendingReconcileAction(stripePending, { status: "canceled" })).toBe(
      "expire"
    );
    expect(
      pendingReconcileAction(stripePending, { status: "requires_payment_method" })
    ).toBe("expire");
  });

  it("skips in-flight statuses so 3DS / processing is not killed", () => {
    for (const status of [
      "requires_action",
      "processing",
      "requires_confirmation",
      "requires_capture",
    ]) {
      expect(pendingReconcileAction(stripePending, { status })).toBe("skip");
    }
  });

  it("expires PENDING rows that never got a payment intent", () => {
    expect(
      pendingReconcileAction(
        { paymentIntentId: null, paymentProvider: "STRIPE" },
        "missing"
      )
    ).toBe("expire");
  });

  it("skips when Stripe retrieve failed (unknown state — fail closed)", () => {
    expect(pendingReconcileAction(stripePending, null)).toBe("skip");
  });

  it("never touches SIMULATED donations", () => {
    expect(
      pendingReconcileAction(
        { paymentIntentId: "pi_sim", paymentProvider: "SIMULATED" },
        { status: "succeeded" }
      )
    ).toBe("skip");
  });
});

describe("reconcilePendingDonations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.donation.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (completeDonation as jest.Mock).mockResolvedValue({ id: "don_ok" });
  });

  it("completes succeeded PIs, expires abandoned ones, skips in-flight and retrieve failures", async () => {
    const old = new Date("2020-01-01T00:00:00Z");
    (prisma.donation.findMany as jest.Mock).mockResolvedValue([
      {
        id: "don_ok",
        paymentIntentId: "pi_ok",
        paymentProvider: "STRIPE",
        createdAt: old,
      },
      {
        id: "don_dead",
        paymentIntentId: "pi_dead",
        paymentProvider: "STRIPE",
        createdAt: old,
      },
      {
        id: "don_3ds",
        paymentIntentId: "pi_3ds",
        paymentProvider: "STRIPE",
        createdAt: old,
      },
      {
        id: "don_nopi",
        paymentIntentId: null,
        paymentProvider: "STRIPE",
        createdAt: old,
      },
      {
        id: "don_sim",
        paymentIntentId: "pi_sim",
        paymentProvider: "SIMULATED",
        createdAt: old,
      },
    ]);

    (retrievePaymentIntent as jest.Mock).mockImplementation(async (id: string) => {
      if (id === "pi_ok") return { status: "succeeded" };
      if (id === "pi_dead") return { status: "canceled" };
      if (id === "pi_3ds") return { status: "requires_action" };
      throw new Error("stripe down");
    });

    const result = await reconcilePendingDonations({
      now: new Date("2020-01-01T03:00:00Z"),
      minAgeMs: 60 * 60 * 1000,
    });

    expect(completeDonation).toHaveBeenCalledWith("don_ok");
    expect(completeDonation).toHaveBeenCalledTimes(1);
    expect(prisma.donation.updateMany).toHaveBeenCalledWith({
      where: { id: "don_dead", status: "PENDING" },
      data: { status: "FAILED" },
    });
    expect(prisma.donation.updateMany).toHaveBeenCalledWith({
      where: { id: "don_nopi", status: "PENDING" },
      data: { status: "FAILED" },
    });
    expect(result).toEqual({
      scanned: 5,
      completed: 1,
      expired: 2,
      skipped: 2,
      errors: [],
    });
  });

  it("does not expire a row when Stripe retrieve throws", async () => {
    (prisma.donation.findMany as jest.Mock).mockResolvedValue([
      {
        id: "don_net",
        paymentIntentId: "pi_net",
        paymentProvider: "STRIPE",
        createdAt: new Date("2020-01-01T00:00:00Z"),
      },
    ]);
    (retrievePaymentIntent as jest.Mock).mockRejectedValue(new Error("timeout"));

    const result = await reconcilePendingDonations({
      now: new Date("2020-01-01T03:00:00Z"),
      minAgeMs: 60 * 60 * 1000,
    });

    expect(completeDonation).not.toHaveBeenCalled();
    expect(prisma.donation.updateMany).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/don_net/);
  });

  it("treats completeDonation returning null as already-settled, not an error", async () => {
    (prisma.donation.findMany as jest.Mock).mockResolvedValue([
      {
        id: "don_race",
        paymentIntentId: "pi_race",
        paymentProvider: "STRIPE",
        createdAt: new Date("2020-01-01T00:00:00Z"),
      },
    ]);
    (retrievePaymentIntent as jest.Mock).mockResolvedValue({ status: "succeeded" });
    (completeDonation as jest.Mock).mockResolvedValue(null);

    const result = await reconcilePendingDonations({
      now: new Date("2020-01-01T03:00:00Z"),
      minAgeMs: 60 * 60 * 1000,
    });

    expect(result.completed).toBe(1);
    expect(result.errors).toEqual([]);
  });
});
