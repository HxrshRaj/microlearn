import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;
export const hashPassword = (p: string) => bcrypt.hash(p, SALT_ROUNDS);
export const verifyPassword = (p: string, hash?: string | null) => (hash ? bcrypt.compare(p, hash) : Promise.resolve(false));

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/;
const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/;

export const isValidEmail = (e: unknown): boolean => typeof e === 'string' && e.length <= 254 && EMAIL_RE.test(e);

export type Check = { valid: true } | { valid: false; reason: string };

export function validateUsername(u: unknown): Check {
  if (typeof u !== 'string') return { valid: false, reason: 'Username is required.' };
  if (!USERNAME_RE.test(u)) {
    return { valid: false, reason: 'Username must be 3-20 characters and contain only letters, numbers, underscores, or hyphens.' };
  }
  return { valid: true };
}

export function validatePassword(p: unknown): Check {
  if (typeof p !== 'string') return { valid: false, reason: 'Password is required.' };
  if (p.length < 8) return { valid: false, reason: 'Password must be at least 8 characters.' };
  if (p.length > 72) return { valid: false, reason: 'Password must be 72 characters or fewer.' };
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return { valid: false, reason: 'Password must contain at least one letter and one number.' };
  return { valid: true };
}
