import { verifyEmail } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const verifySchema = z.object({
  token: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = verifySchema.parse(body);

    await verifyEmail(validated.token);

    return NextResponse.json(
      {
        success: true,
        message: "Email verified successfully. You can now log in.",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Email verification failed" },
      { status: 400 }
    );
  }
}
