"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProd = exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
// Load .env relative to this file's own location, not process.cwd() — under
// Passenger the working directory the app is spawned with isn't guaranteed
// to be the Application Root, so the plain `dotenv/config` default (which
// only ever looks in cwd) can silently find nothing. This still never
// overrides variables cPanel's own "Environment Variables" UI already set.
dotenv_1.default.config({ path: path_1.default.join(__dirname, "..", ".env") });
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
    PORT: zod_1.z.coerce.number().default(4000),
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL is required"),
    JWT_ACCESS_SECRET: zod_1.z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
    JWT_ACCESS_TTL: zod_1.z.string().default("15m"),
    JWT_REFRESH_TTL_DAYS: zod_1.z.coerce.number().default(30),
    WEB_APP_URL: zod_1.z.string().default("http://localhost:3000"),
    COOKIE_DOMAIN: zod_1.z.string().optional(),
    UPLOAD_DIR: zod_1.z.string().default("uploads"),
    MAX_UPLOAD_MB: zod_1.z.coerce.number().default(15),
    RATE_LIMIT_WINDOW_MIN: zod_1.z.coerce.number().default(15),
    RATE_LIMIT_MAX: zod_1.z.coerce.number().default(300),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsed.data;
exports.isProd = exports.env.NODE_ENV === "production";
