import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load .env relative to this file's own location, not process.cwd() — under
// Passenger the working directory the app is spawned with isn't guaranteed
// to be the Application Root, so the plain `dotenv/config` default (which
// only ever looks in cwd) can silently find nothing. This still never
// overrides variables cPanel's own "Environment Variables" UI already set.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  WEB_APP_URL: z.string().default("http://localhost:3000"),
  COOKIE_DOMAIN: z.string().optional(),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().default(15),
  RATE_LIMIT_WINDOW_MIN: z.coerce.number().default(15),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
