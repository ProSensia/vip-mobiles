import rateLimit from "express-rate-limit";
import { env } from "../env";

export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limiter for auth endpoints to slow down credential stuffing / brute force.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

// Buy-request / public form submissions: prevent spam without blocking real shoppers.
export const publicFormLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." },
});

// Shopping assistant chat: a real conversation needs more turns than a
// one-shot form, but each turn still costs a couple of indexed DB queries —
// capped well below anything that could be used to scrape the catalog.
export const assistantLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You're sending messages a bit fast — please wait a moment and try again." },
});
