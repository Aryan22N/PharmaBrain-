import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, generateToken, generate9DigitPatientId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    const users = await query(
      `SELECT id, name, email, "passwordHash", "patientId", "legacyPatientId" 
       FROM "User" 
       WHERE LOWER(email) = LOWER($1) 
       LIMIT 1;`,
      [trimmedEmail]
    );

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email address or password' },
        { status: 401 }
      );
    }

    const user = users[0];
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email address or password' },
        { status: 401 }
      );
    }

    // Ensure user has a valid 9-digit patient ID permanently stored
    let patientId = user.patientId;
    if (!patientId) {
      patientId = generate9DigitPatientId();
      await query(
        `UPDATE "User" SET "patientId" = $1 WHERE id = $2;`,
        [patientId, user.id]
      );
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      patientId,
    });

    const response = NextResponse.json(
      {
        message: 'Signed in successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          patientId,
          legacyPatientId: user.legacyPatientId || null,
        },
        token,
      },
      { status: 200 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error during login' },
      { status: 500 }
    );
  }
}
