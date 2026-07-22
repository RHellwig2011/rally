import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
import { sendEmailVerification } from '@/lib/email';
import { checkAuthRateLimit } from '@/lib/utils/rate-limiter';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['CAMPAIGN_LEADER', 'GUARDIAN', 'DONOR']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signupSchema.parse(body);

    // Bounds account-creation floods and the outbound verification email they
    // would trigger.
    const rateLimitCheck = checkAuthRateLimit(request, validatedData.email);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    // Create user using the existing registerUser function
    const { user, verificationToken } = await registerUser({
      email: validatedData.email,
      password: validatedData.password,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      role: validatedData.role || 'CAMPAIGN_LEADER',
    });

    // Send verification email in the background — the token belongs only in
    // the email link, never in the API response.
    sendEmailVerification({
      toEmail: user.email,
      toName: user.firstName,
      verificationToken,
    }).catch((err) => {
      console.error('Failed to send verification email:', err);
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully! Please sign in.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    // Handle duplicate email error
    if (error instanceof Error && error.message.includes('already in use')) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
