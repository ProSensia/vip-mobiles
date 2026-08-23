"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.verifyAccessToken = verifyAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.hashToken = hashToken;
exports.refreshTokenExpiry = refreshTokenExpiry;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../env");
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_ACCESS_SECRET, { expiresIn: env_1.env.JWT_ACCESS_TTL });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
}
/** Refresh tokens are opaque random strings; only their SHA-256 hash is persisted. */
function generateRefreshToken() {
    const token = crypto_1.default.randomBytes(48).toString("hex");
    const hash = hashToken(token);
    return { token, hash };
}
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function refreshTokenExpiry() {
    const days = env_1.env.JWT_REFRESH_TTL_DAYS;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
