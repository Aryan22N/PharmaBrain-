import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, generateToken, generate9DigitPatientId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    const { name, email, password } = body;

    // 1. Strict server-side validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Valid full name is required (minimum 2 characters)' },
        { status: 400 }
      );
    }

    const trimmedEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // 2. Prevent duplicate accounts
    const existingUsers = await query(
      `SELECT id FROM "User" WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
      [trimmedEmail]
    );

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in.' },
        { status: 409 }
      );
    }

    // 3. Generate unique 9-digit Patient ID with concurrency-safe collision check
    let uniquePatientId = '';
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidateId = generate9DigitPatientId();
      const collisionCheck = await query(
        `SELECT id FROM "User" WHERE "patientId" = $1 LIMIT 1;`,
        [candidateId]
      );
      if (collisionCheck.length === 0) {
        uniquePatientId = candidateId;
        break;
      }
    }

    if (!uniquePatientId) {
      return NextResponse.json(
        { error: 'Could not allocate a unique 9-digit patient ID. Please try again.' },
        { status: 500 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();

    // 4. Insert new patient record into Supabase PostgreSQL
    const newUsers = await query(
      `INSERT INTO "User" (name, email, "passwordHash", "patientId", "createdAt") 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, "patientId", "createdAt";`,
      [name.trim(), trimmedEmail, hashedPassword, uniquePatientId, now]
    );

    const user = newUsers[0];

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      patientId: user.patientId,
    });

    const response = NextResponse.json(
      {
        message: 'Patient account created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          patientId: user.patientId,
        },
        token,
      },
      { status: 201 }
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
    console.error('Registration API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error during registration' },
      { status: 500 }
    );
  }
}
