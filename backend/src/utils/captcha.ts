import crypto from "crypto";

// Self-hosted, dependency-free challenge instead of a third-party CAPTCHA
// service (reCAPTCHA/Turnstile need API keys the deploy doesn't have) — a
// simple arithmetic question is enough to stop credential-stuffing scripts,
// which don't render/solve challenges, without any external network call or
// JS/image dependency (works on any connection speed, no third-party
// script to fail to load).
//
// In-memory is safe here specifically because this deployment runs a
// single warm Passenger instance (PassengerMinInstances 1, no horizontal
// scaling) — a multi-instance deployment would need a shared store instead.
interface Challenge {
  answer: number;
  expiresAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challenges = new Map<string, Challenge>();

setInterval(() => {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (c.expiresAt < now) challenges.delete(id);
  }
}, 5 * 60 * 1000).unref();

export function createCaptcha(): { id: string; question: string } {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const id = crypto.randomBytes(16).toString("hex");
  challenges.set(id, { answer: a + b, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  return { id, question: `${a} + ${b}` };
}

/** One-time use — consumed whether or not the answer is correct, so a wrong guess can't be retried against the same challenge. */
export function verifyCaptcha(id: string | undefined, answer: number | undefined): boolean {
  if (!id || answer === undefined) return false;
  const challenge = challenges.get(id);
  challenges.delete(id);
  if (!challenge || challenge.expiresAt < Date.now()) return false;
  return challenge.answer === answer;
}
