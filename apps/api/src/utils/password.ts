import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function isStrongPassword(password: string): boolean {
  // At least 8 chars, one letter, one number.
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
}
