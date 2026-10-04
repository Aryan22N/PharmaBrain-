import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'pharma_brain_patient_dmr_jwt_secret_key_2026_super_secure!';

export interface JWTPayload {
  userId: number;
  email: string;
  name: string;
  patientId: string;
}

/**
 * Generate a JWT token containing authenticated user ID, email, name, and 9-digit patient ID
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify and decode an incoming JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Hash patient account password securely
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain password against stored bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a cryptographically strong, non-sequential 9-digit numeric Patient ID.
 * Returns a 9-digit string between "100000000" and "999999999" (e.g. "483027156").
 */
export function generate9DigitPatientId(): string {
  const min = 100000000;
  const max = 999999999;
  const range = max - min + 1;
  const randomBuffer = crypto.randomBytes(4);
  const randomUInt = randomBuffer.readUInt32BE(0);
  const patientNum = min + (randomUInt % range);
  return patientNum.toString();
}
