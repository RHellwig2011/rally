/**
 * @jest-environment node
 *
 * H9: scheduled outreach pickup. Conditional SCHEDULED→SENDING claim so two
 * overlapping cron ticks cannot double-send, and recipients always run through
 * partitionSuppressed. In-memory prisma fake — no database.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = {
    outreachCampaign: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    teamMember: { findMany: jest.fn() },
    outreachLog: { create: jest.fn() },
    contact: { update: jest.fn() },
  };
  return { __esModule: true, default: prisma, prisma };
});

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("@/lib/services/sms", () => ({
  sendSMS: jest.fn(),
  formatPhoneNumber: (phone: string) => phone,
}));

jest.mock("@/lib/suppression", () => ({
  partitionSuppressed: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { partitionSuppressed } from "@/lib/suppression";
import { processScheduledOutreach } from "@/lib/outreach";

const sendEmailMock = sendEmail as jest.Mock;
const partitionMock = partitionSuppressed as jest.Mock;
const findMany = prisma.outreachCampaign.findMany as jest.Mock;
const findUnique = prisma.outreachCampaign.findUnique as jest.Mock;
const updateMany = prisma.outreachCampaign.updateMany as jest.Mock;
const update = prisma.outreachCampaign.update as jest.Mock;
const teamMemberFindMany = prisma.teamMember.findMany as jest.Mock;
const logCreate = prisma.outreachLog.create as jest.Mock;
const contactUpdate = prisma.contact.update as jest.Mock;

type OutreachRow = {
  id: string;
  status: string;
  scheduledFor: Date | null;
  campaignId: string;
  type: "EMAIL" | "SMS" | "BOTH";
  emailSubject: string | null;
  emailBody: string | null;
  smsBody: string | null;
  campaign: { id: string; slug: string; programId: string | null };
  [key: string]: unknown;
};

function matches(
  row: Record<string, unknown>,
  where: Record<string, unknown>
): boolean {
  for (const [key, cond] of Object.entries(where)) {
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      const range = cond as { lte?: Date };
      if (range.lte !== undefined) {
        if (!(value instanceof Date) || value.getTime() > range.lte.getTime()) {
          return false;
        }
        continue;
      }
    }
    if (value !== cond) return false;
  }
  return true;
}

function useRows(rows: OutreachRow[]) {
  findMany.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) =>
      rows.filter((row) => matches(row, where)).map((row) => ({ id: row.id }))
  );

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
        if (!matches(row, where)) continue;
        count++;
        Object.assign(row, data);
      }
      return { count };
    }
  );

  findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) =>
      rows.find((row) => row.id === where.id) ?? null
  );

  update.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) return null;
      Object.assign(row, data);
      return row;
    }
  );

  return rows;
}

function scheduledRow(overrides: Partial<OutreachRow> = {}): OutreachRow {
  return {
    id: "oc_1",
    status: "SCHEDULED",
    scheduledFor: new Date(Date.now() - 60_000),
    campaignId: "camp_1",
    type: "EMAIL",
    emailSubject: "Help us raise",
    emailBody: "Hi {firstName}",
    smsBody: null,
    campaign: { id: "camp_1", slug: "lincoln-football", programId: "prog_1" },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  sendEmailMock.mockResolvedValue({ status: "SENT", id: "re_msg_1" });
  partitionMock.mockResolvedValue({ allowed: [], suppressed: [] });
  teamMemberFindMany.mockResolvedValue([]);
  logCreate.mockResolvedValue({});
  contactUpdate.mockResolvedValue({});
});

describe("processScheduledOutreach", () => {
  it("transitions a due campaign SCHEDULED → SENDING exactly once across overlapping ticks", async () => {
    const rows = useRows([scheduledRow()]);
    const allowed = [
      { id: "ct_1", email: "a@example.com", phone: null, firstName: "Ann" },
    ];
    teamMemberFindMany.mockResolvedValue([{ contacts: allowed }]);
    partitionMock.mockResolvedValue({ allowed, suppressed: [] });

    const [first, second] = await Promise.all([
      processScheduledOutreach(),
      processScheduledOutreach(),
    ]);

    const claimed = first.claimed + second.claimed;
    expect(claimed).toBe(1);
    expect(rows[0].status).toBe("SENT");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@example.com" })
    );
  });

  it("does not pick up campaigns whose scheduledFor is still in the future", async () => {
    useRows([
      scheduledRow({
        scheduledFor: new Date(Date.now() + 60 * 60_000),
      }),
    ]);

    const result = await processScheduledOutreach();

    expect(result.claimed).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("runs recipients through partitionSuppressed and does not email opted-out contacts", async () => {
    useRows([scheduledRow()]);

    const allowed = [
      { id: "ct_ok", email: "ok@example.com", phone: null, firstName: "Ok" },
    ];
    const suppressed = [
      { id: "ct_no", email: "no@example.com", phone: null, firstName: "No" },
    ];

    teamMemberFindMany.mockResolvedValue([
      { contacts: [...allowed, ...suppressed] },
    ]);
    partitionMock.mockImplementation(async (recipients: Array<{ email: string | null }>) => {
      const emails = recipients.map((r) => r.email);
      if (emails.includes("no@example.com") || emails.includes("ok@example.com")) {
        return {
          allowed: recipients.filter((r) => r.email === "ok@example.com"),
          suppressed: recipients.filter((r) => r.email === "no@example.com"),
        };
      }
      return { allowed: [], suppressed: [] };
    });

    const result = await processScheduledOutreach();

    expect(result.claimed).toBe(1);
    expect(result.sent).toBe(1);
    expect(partitionMock).toHaveBeenCalled();
    expect(partitionMock.mock.calls.some((call) => call[1] === "EMAIL")).toBe(
      true
    );

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ok@example.com" })
    );
    expect(
      sendEmailMock.mock.calls.some((call) => call[0].to === "no@example.com")
    ).toBe(false);

    const suppressedLogs = logCreate.mock.calls.filter(
      (call) => call[0].data.recipientEmail === "no@example.com"
    );
    expect(suppressedLogs.length).toBeGreaterThanOrEqual(1);
    expect(suppressedLogs[0][0].data.status).toBe("FAILED");
    expect(suppressedLogs[0][0].data.sentAt).toBeNull();
    expect(suppressedLogs[0][0].data.failureReason).toMatch(/opted out/i);
  });

  it("marks FAILED when the claimed send throws, without leaving the row SENDING", async () => {
    const rows = useRows([scheduledRow()]);
    findUnique.mockRejectedValueOnce(new Error("db blip"));

    const result = await processScheduledOutreach();

    expect(result.claimed).toBe(1);
    expect(result.failed).toBe(1);
    expect(rows[0].status).toBe("FAILED");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
