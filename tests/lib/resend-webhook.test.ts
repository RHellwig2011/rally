/**
 * @jest-environment node
 *
 * H9: Resend (Svix) webhook signature + idempotent open/click counters.
 * In-memory prisma fake — no database.
 */

jest.mock("@/lib/prisma", () => {
  const prisma = {
    outreachLog: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    outreachCampaign: {
      update: jest.fn(),
    },
  };
  return { __esModule: true, default: prisma, prisma };
});

import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  applyResendClick,
  applyResendOpen,
  verifyResendWebhookSignature,
} from "@/lib/resend-webhook";
import { POST } from "@/app/api/webhooks/resend/route";

const findFirst = prisma.outreachLog.findFirst as jest.Mock;
const updateMany = prisma.outreachLog.updateMany as jest.Mock;
const campaignUpdate = prisma.outreachCampaign.update as jest.Mock;

const SECRET_BYTES = Buffer.from("resend-webhook-test-secret");
const WEBHOOK_SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;

function sign(payload: string, id: string, timestamp: string): string {
  const digest = createHmac("sha256", SECRET_BYTES)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return `v1,${digest}`;
}

type LogRow = {
  id: string;
  outreachCampaignId: string;
  providerMessageId: string;
  type: string;
  status: string;
  openedAt: Date | null;
  clickedAt: Date | null;
};

function matches(row: LogRow, where: Record<string, unknown>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    const value = (row as unknown as Record<string, unknown>)[key];
    if (cond === null) {
      if (value !== null) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function useLogs(rows: LogRow[]) {
  findFirst.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) =>
      rows.find((row) => matches(row, where)) ?? null
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

  campaignUpdate.mockResolvedValue({});
  return rows;
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.RESEND_WEBHOOK_SECRET;
});

describe("verifyResendWebhookSignature", () => {
  const payload = JSON.stringify({
    type: "email.opened",
    data: { email_id: "re_1" },
  });
  const id = "msg_1";
  const timestamp = String(Math.floor(Date.now() / 1000));

  it("accepts a valid v1 HMAC over id.timestamp.payload", () => {
    expect(
      verifyResendWebhookSignature({
        payload,
        svixId: id,
        svixTimestamp: timestamp,
        svixSignature: sign(payload, id, timestamp),
        secret: WEBHOOK_SECRET,
      })
    ).toBe(true);
  });

  it("rejects a tampered payload", () => {
    expect(
      verifyResendWebhookSignature({
        payload: payload + " ",
        svixId: id,
        svixTimestamp: timestamp,
        svixSignature: sign(payload, id, timestamp),
        secret: WEBHOOK_SECRET,
      })
    ).toBe(false);
  });

  it("rejects a missing or empty secret", () => {
    expect(
      verifyResendWebhookSignature({
        payload,
        svixId: id,
        svixTimestamp: timestamp,
        svixSignature: sign(payload, id, timestamp),
        secret: "",
      })
    ).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    const stale = String(Math.floor(Date.now() / 1000) - 301);
    expect(
      verifyResendWebhookSignature({
        payload,
        svixId: id,
        svixTimestamp: stale,
        svixSignature: sign(payload, id, stale),
        secret: WEBHOOK_SECRET,
      })
    ).toBe(false);
  });
});

describe("POST /api/webhooks/resend", () => {
  const payload = JSON.stringify({
    type: "email.opened",
    data: { email_id: "re_unknown" },
  });

  function request(headers: Record<string, string>, body: string) {
    return new NextRequest("http://localhost/api/webhooks/resend", {
      method: "POST",
      headers,
      body,
    });
  }

  it("returns 401 when RESEND_WEBHOOK_SECRET is unset", async () => {
    const res = await POST(
      request(
        {
          "svix-id": "msg_1",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "v1,abc",
        },
        payload
      )
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when the signature is invalid", async () => {
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const res = await POST(
      request(
        {
          "svix-id": "msg_1",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        },
        payload
      )
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when svix headers are missing", async () => {
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const res = await POST(request({}, payload));
    expect(res.status).toBe(401);
  });
});

describe("open/click counters", () => {
  it("increments emailsOpened on the first open and is idempotent on redelivery", async () => {
    const rows = useLogs([
      {
        id: "log_1",
        outreachCampaignId: "oc_1",
        providerMessageId: "re_1",
        type: "EMAIL",
        status: "SENT",
        openedAt: null,
        clickedAt: null,
      },
    ]);

    const first = await applyResendOpen("re_1");
    const second = await applyResendOpen("re_1");

    expect(first.updated).toBe(true);
    expect(second.updated).toBe(false);
    expect(rows[0].openedAt).toBeInstanceOf(Date);
    expect(rows[0].status).toBe("OPENED");
    expect(campaignUpdate).toHaveBeenCalledTimes(1);
    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: "oc_1" },
      data: { emailsOpened: { increment: 1 } },
    });
  });

  it("increments linksClicked on the first click and is idempotent on redelivery", async () => {
    const rows = useLogs([
      {
        id: "log_1",
        outreachCampaignId: "oc_1",
        providerMessageId: "re_1",
        type: "EMAIL",
        status: "OPENED",
        openedAt: new Date(),
        clickedAt: null,
      },
    ]);

    const first = await applyResendClick("re_1");
    const second = await applyResendClick("re_1");

    expect(first.updated).toBe(true);
    expect(second.updated).toBe(false);
    expect(rows[0].clickedAt).toBeInstanceOf(Date);
    expect(rows[0].status).toBe("CLICKED");
    expect(campaignUpdate).toHaveBeenCalledTimes(1);
    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: "oc_1" },
      data: { linksClicked: { increment: 1 } },
    });
  });

  it("does not downgrade CLICKED to OPENED when the open arrives second", async () => {
    const rows = useLogs([
      {
        id: "log_1",
        outreachCampaignId: "oc_1",
        providerMessageId: "re_1",
        type: "EMAIL",
        status: "CLICKED",
        openedAt: null,
        clickedAt: new Date(),
      },
    ]);

    const result = await applyResendOpen("re_1");

    expect(result.updated).toBe(true);
    expect(rows[0].status).toBe("CLICKED");
    expect(rows[0].openedAt).toBeInstanceOf(Date);
    expect(campaignUpdate).toHaveBeenCalledTimes(1);
  });
});
