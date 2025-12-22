import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// Password validation
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
}

// Display name validation
function validateDisplayName(name: string): { valid: boolean; error?: string } {
  if (name.length < 3 || name.length > 20) {
    return { valid: false, error: 'Display name must be 3-20 characters' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return { valid: false, error: 'Display name can only contain letters, numbers, underscores, and hyphens' };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, displayName } = body;

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid email address' } },
        { status: 400 }
      );
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: passwordCheck.error } },
        { status: 400 }
      );
    }

    // Validate display name
    const nameCheck = validateDisplayName(displayName);
    if (!nameCheck.valid) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: nameCheck.error } },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' } },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user and credentials account in transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name: displayName,
          displayName,
        },
      });

      // Store password hash in Account's access_token field
      await tx.account.create({
        data: {
          userId: newUser.id,
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: newUser.id,
          access_token: hashedPassword,
        },
      });

      return newUser;
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
