/**
 * @jest-environment node
 *
 * Moving-goal math + conditional stretch claim. In-memory prisma fake — no DB.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = {
    campaign: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  return { __esModule: true, default: prisma, prisma };
});

jest.mock("@/lib/email", () => ({
  sendCampaignStatusChangeNotification: jest.fn(),
}));

jest.mock("@/lib/outreach", () => ({
  processScheduledOutreach: jest.fn(),
}));

import prisma from "@/lib/prisma";
import {
  computeStretchedGoalAmount,
  isStretchTriggered,
  nextStretchGoalAmount,
  roundUpToWholeDollar,
} from "@/lib/stretch-goal";
import { applyAutoStretchGoals } from "@/lib/utils/campaign-automation";

const findMany = prisma.campaign.findMany as jest.Mock;
const updateMany = prisma.campaign.updateMany as jest.Mock;

type CampaignRow = {
  id: string;
  status: string;
  autoStretchGoal: boolean;
  currentAmount: bigint;
  goalAmount: bigint;
  originalGoalAmount: bigint | null;
  stretchGoalPercent: number;
  stretchGoalTriggerPercent: number;
};

function matchesGoal(
  row: CampaignRow,
  where: { id: string; goalAmount: bigint; autoStretchGoal?: boolean; status?: string }
): boolean {
  if (row.id !== where.id) return false;
  if (row.goalAmount !== where.goalAmount) return false;
  if (where.autoStretchGoal !== undefined && row.autoStretchGoal !== where.autoStretchGoal) {
    return false;
  }
  if (where.status !== undefined && row.status !== where.status) return false;
  return true;
}

function useCampaigns(rows: CampaignRow[]): CampaignRow[] {
  findMany.mockImplementation(async () => rows.map((row) => ({ ...row })));
  updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: string; goalAmount: bigint; autoStretchGoal?: boolean; status?: string };
      data: Partial<CampaignRow>;
    }) => {
      let count = 0;
      for (const row of rows) {
        if (!matchesGoal(row, where)) continue;
        Object.assign(row, data);
        count++;
      }
      return { count };
    }
  );
  return rows;
}

beforeEach(() => {
  findMany.mockReset();
  updateMany.mockReset();
});

describe("stretch-goal math", () => {
  it("raises by the stretch percent and stays on a whole dollar", () => {
    // $100 + 20% = $120
    expect(computeStretchedGoalAmount(BigInt(10000), 20)).toBe(BigInt(12000));
  });

  it("rounds the stretched amount up to a whole dollar", () => {
    // $10.01 * 1.20 = 1201.2 cents -> ceil to 1202 cents -> round up to $12.02? 
    // ceil(1001*120/100)=ceil(1201.2)=1202 cents, rem 2 -> $12.02? wait round up to dollar = 1300
    expect(roundUpToWholeDollar(BigInt(1202))).toBe(BigInt(1300));
    expect(computeStretchedGoalAmount(BigInt(1001), 20)).toBe(BigInt(1300));
  });

  it("triggers at or past the trigger percent", () => {
    expect(isStretchTriggered(BigInt(9000), BigInt(10000), 90)).toBe(true);
    expect(isStretchTriggered(BigInt(8999), BigInt(10000), 90)).toBe(false);
  });

  it("returns null when not at the trigger", () => {
    expect(
      nextStretchGoalAmount({
        currentAmount: BigInt(5000),
        goalAmount: BigInt(10000),
        originalGoalAmount: null,
        stretchPercent: 20,
        triggerPercent: 90,
      })
    ).toBeNull();
  });

  it("caps at 4x the original goal", () => {
    // original $100, current goal $350, 20% would be $420, cap is $400
    expect(
      nextStretchGoalAmount({
        currentAmount: BigInt(35000),
        goalAmount: BigInt(35000),
        originalGoalAmount: BigInt(10000),
        stretchPercent: 20,
        triggerPercent: 90,
      })
    ).toBe(BigInt(40000));
  });

  it("does not stretch once the 4x cap is reached", () => {
    expect(
      nextStretchGoalAmount({
        currentAmount: BigInt(40000),
        goalAmount: BigInt(40000),
        originalGoalAmount: BigInt(10000),
        stretchPercent: 20,
        triggerPercent: 90,
      })
    ).toBeNull();
  });
});

describe("applyAutoStretchGoals", () => {
  it("stretches an ACTIVE opted-in campaign at the trigger", async () => {
    const rows = useCampaigns([
      {
        id: "c1",
        status: "ACTIVE",
        autoStretchGoal: true,
        currentAmount: BigInt(9000),
        goalAmount: BigInt(10000),
        originalGoalAmount: null,
        stretchGoalPercent: 20,
        stretchGoalTriggerPercent: 90,
      },
    ]);

    const stats = await applyAutoStretchGoals();
    expect(stats.stretched).toBe(1);
    expect(rows[0].goalAmount).toBe(BigInt(12000));
    expect(rows[0].originalGoalAmount).toBe(BigInt(10000));
  });

  it("two overlapping ticks cannot double-stretch", async () => {
    const rows = useCampaigns([
      {
        id: "c1",
        status: "ACTIVE",
        autoStretchGoal: true,
        currentAmount: BigInt(9000),
        goalAmount: BigInt(10000),
        originalGoalAmount: null,
        stretchGoalPercent: 20,
        stretchGoalTriggerPercent: 90,
      },
    ]);

    const [a, b] = await Promise.all([
      applyAutoStretchGoals(),
      applyAutoStretchGoals(),
    ]);
    expect(a.stretched + b.stretched).toBe(1);
    expect(rows[0].goalAmount).toBe(BigInt(12000));
    expect(rows[0].originalGoalAmount).toBe(BigInt(10000));
  });

  it("stops at 4x the original goal", async () => {
    const rows = useCampaigns([
      {
        id: "c1",
        status: "ACTIVE",
        autoStretchGoal: true,
        currentAmount: BigInt(40000),
        goalAmount: BigInt(40000),
        originalGoalAmount: BigInt(10000),
        stretchGoalPercent: 20,
        stretchGoalTriggerPercent: 90,
      },
    ]);

    const stats = await applyAutoStretchGoals();
    expect(stats.stretched).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
    expect(rows[0].goalAmount).toBe(BigInt(40000));
  });
});
