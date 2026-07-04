import { createHash, randomBytes } from 'crypto';

// Random, purpose-bound, one-time secret tokens (invitations, and similar).
// Only the hash is stored; the raw token is shown once at creation.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}
