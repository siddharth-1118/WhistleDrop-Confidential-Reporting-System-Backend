import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

/**
 * Generates a cryptographically random, non-predictable case code.
 * Format: WD-XXXX-XXXX (e.g. WD-8K3P-9X2M)
 */
export function generateCaseCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without confusing chars (0, O, 1, I)
  const bytes = crypto.randomBytes(8);
  let part1 = '';
  let part2 = '';

  for (let i = 0; i < 4; i++) {
    part1 += chars[bytes[i] % chars.length];
  }
  for (let i = 4; i < 8; i++) {
    part2 += chars[bytes[i] % chars.length];
  }

  return `WD-${part1}-${part2}`;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtPayload {
  moderatorId: string;
  username: string;
  role: string;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
