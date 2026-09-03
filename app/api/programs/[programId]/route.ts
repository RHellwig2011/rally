import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";

/**
 * PATCH /api/programs/[programId]
 *
 * H4: maintain the program's legal/tax identity used on IRS-shaped receipts.
 * Leaders (primary leader of any of the program's campaigns) may set the
 * legal name and EIN; only ADMIN may flip `isTaxExempt` — the deductibility
 * claim on receipts is a staff attestation that a 501(c)(3) determination is
 * actually on file, not something an org can self-assert.
 */

const einPattern = /^\d{2}-?\d{7}$/;

const patchSchema = z
  .object({
    legalName: z.string().trim().min(2).max(200).nullable().optional(),
    ein: z
      .string()
      .trim()
      .regex(einPattern, "EIN must be 9 digits (XX-XXXXXXX)")
      .nullable()
      .optional(),
    isTaxExempt: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { programId: string } }
) {
  try {
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    const sessionToken = req.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }
    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const program = await prisma.program.findUnique({
      where: { id: params.programId },
      select: {
        id: true,
        campaigns: { select: { primaryLeaderId: true } },
      },
    });
    if (!program) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 }
      );
    }

    const isAdmin = user.role === "ADMIN";
    const isLeader = program.campaigns.some(
      (c) => c.primaryLeaderId === user.id
    );
    if (!isAdmin && !isLeader) {
      return NextResponse.json(
        { success: false, error: "Not authorized to manage this program" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.errors },
        { status: 400 }
      );
    }

    if (parsed.data.isTaxExempt !== undefined && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only platform staff can change tax-exempt status after verifying the 501(c)(3) determination",
        },
        { status: 403 }
      );
    }

    // Changing the legal identity invalidates a prior staff attestation: a
    // leader edit to legalName/ein clears isTaxExempt until staff re-verify.
    const identityEdited =
      parsed.data.legalName !== undefined || parsed.data.ein !== undefined;

    const updated = await prisma.program.update({
      where: { id: params.programId },
      data: {
        ...(parsed.data.legalName !== undefined && {
          legalName: parsed.data.legalName,
        }),
        ...(parsed.data.ein !== undefined && { ein: parsed.data.ein }),
        ...(parsed.data.isTaxExempt !== undefined
          ? { isTaxExempt: parsed.data.isTaxExempt }
          : identityEdited && !isAdmin
            ? { isTaxExempt: false }
            : {}),
      },
      select: {
        id: true,
        legalName: true,
        ein: true,
        isTaxExempt: true,
      },
    });

    return NextResponse.json({ success: true, program: updated });
  } catch (error) {
    console.error("Failed to update program:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update program" },
      { status: 500 }
    );
  }
}
