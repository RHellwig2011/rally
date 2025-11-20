import { resetPassword } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const resetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = resetSchema.parse(body);

    await resetPassword(validated.token, validated.newPassword);

    return NextResponse.json(
      {
        success: true,
        message: "Password reset successfully. You can now log in with your new password.",
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
      { success: false, error: error instanceof Error ? error.message : "Password reset failed" },
      { status: 400 }
    );
  }
}
