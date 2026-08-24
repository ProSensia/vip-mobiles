"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const rateLimit_1 = require("../../middleware/rateLimit");
const auth_1 = require("../../middleware/auth");
const password_1 = require("../../utils/password");
const jwt_1 = require("../../utils/jwt");
const mailer_1 = require("../../lib/mailer");
const audit_1 = require("../../utils/audit");
const shared_1 = require("../../shared");
const env_1 = require("../../env");
const captcha_1 = require("../../utils/captcha");
const router = (0, express_1.Router)();
const cookieOpts = {
    httpOnly: true,
    secure: env_1.isProd,
    sameSite: "lax",
    domain: env_1.env.COOKIE_DOMAIN,
};
async function issueSession(res, userId, role, permissions) {
    const accessToken = (0, jwt_1.signAccessToken)({ sub: userId, role, permissions });
    const { token: refreshToken, hash } = (0, jwt_1.generateRefreshToken)();
    await prisma_1.prisma.refreshToken.create({
        data: { userId, tokenHash: hash, expiresAt: (0, jwt_1.refreshTokenExpiry)() },
    });
    res.cookie("access_token", accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
    res.cookie("refresh_token", refreshToken, {
        ...cookieOpts,
        maxAge: env_1.env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
}
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
    captchaId: zod_1.z.string().min(1),
    captchaAnswer: zod_1.z.coerce.number(),
});
const LOCK_THRESHOLD = 3;
const LOCK_MINUTES = 30;
router.get("/captcha", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    res.json((0, captcha_1.createCaptcha)());
}));
router.post("/login", rateLimit_1.authLimiter, (0, validate_1.validateBody)(loginSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password, captchaId, captchaAnswer } = req.body;
    if (!(0, captcha_1.verifyCaptcha)(captchaId, captchaAnswer)) {
        (0, audit_1.recordAudit)(req, { action: "auth.login.blocked", entityType: "User", entityId: email, meta: { reason: "captcha" } });
        throw new errorHandler_1.ApiError(400, "Incorrect answer to the verification question. Please try again.");
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
        throw new errorHandler_1.ApiError(401, "Invalid email or password");
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
        (0, audit_1.recordAudit)(req, { action: "auth.login.blocked", entityType: "User", entityId: user.id, meta: { reason: "locked", minutesLeft } });
        throw new errorHandler_1.ApiError(423, `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`);
    }
    const valid = await (0, password_1.verifyPassword)(password, user.passwordHash);
    if (!valid) {
        const attempts = user.failedLoginAttempts + 1;
        const lockingNow = attempts >= LOCK_THRESHOLD;
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: lockingNow
                ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
                : { failedLoginAttempts: attempts },
        });
        (0, audit_1.recordAudit)(req, { action: "auth.login.failed", entityType: "User", entityId: user.id, meta: { attempts, locked: lockingNow } });
        if (lockingNow) {
            throw new errorHandler_1.ApiError(423, `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`);
        }
        throw new errorHandler_1.ApiError(401, "Invalid email or password");
    }
    await issueSession(res, user.id, user.role, user.permissions);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    req.user = { id: user.id, role: user.role, permissions: user.permissions };
    (0, audit_1.recordAudit)(req, { action: "auth.login.success", entityType: "User", entityId: user.id });
    res.json({
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatarUrl: user.avatarUrl,
            mustChangePassword: user.mustChangePassword,
            permissions: (0, shared_1.effectivePermissions)({ role: user.role, permissions: user.permissions }),
        },
    });
}));
router.post("/refresh", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const token = req.cookies?.refresh_token;
    if (!token)
        throw new errorHandler_1.ApiError(401, "Not authenticated");
    const hash = (0, jwt_1.hashToken)(token);
    const record = await prisma_1.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
        throw new errorHandler_1.ApiError(401, "Session expired, please log in again");
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive)
        throw new errorHandler_1.ApiError(401, "Account is not active");
    // Rotate: revoke the used refresh token, issue a fresh pair.
    await prisma_1.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    await issueSession(res, user.id, user.role, user.permissions);
    res.json({ ok: true });
}));
router.post("/logout", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const token = req.cookies?.refresh_token;
    if (token) {
        const hash = (0, jwt_1.hashToken)(token);
        await prisma_1.prisma.refreshToken.updateMany({ where: { tokenHash: hash }, data: { revokedAt: new Date() } });
    }
    res.clearCookie("access_token", cookieOpts);
    res.clearCookie("refresh_token", cookieOpts);
    res.json({ ok: true });
}));
router.get("/me", auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        include: { branch: true, staffProfile: true },
    });
    if (!user || !user.isActive)
        throw new errorHandler_1.ApiError(401, "Account is not active");
    res.json({
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatarUrl: user.avatarUrl,
            branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
            mustChangePassword: user.mustChangePassword,
            permissions: (0, shared_1.effectivePermissions)({ role: user.role, permissions: user.permissions }),
        },
    });
}));
const forgotSchema = zod_1.z.object({ email: zod_1.z.string().email() });
router.post("/forgot-password", rateLimit_1.authLimiter, (0, validate_1.validateBody)(forgotSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { email: req.body.email } });
    // Always respond 200 to avoid leaking which emails are registered.
    if (user && user.isActive) {
        const token = crypto_1.default.randomBytes(32).toString("hex");
        const hash = (0, jwt_1.hashToken)(token);
        await prisma_1.prisma.passwordResetToken.create({
            data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
        });
        const resetUrl = `${env_1.env.WEB_APP_URL}/reset-password?token=${token}`;
        await (0, mailer_1.sendMail)({
            to: user.email,
            subject: "Reset your VIP Mobiles admin password",
            text: `Hi ${user.name},\n\nReset your password using this link (valid 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
        });
        (0, audit_1.recordAudit)(req, { action: "auth.password.forgot", entityType: "User", entityId: user.id });
    }
    res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
}));
const resetSchema = zod_1.z.object({
    token: zod_1.z.string().min(10),
    newPassword: zod_1.z.string().refine(password_1.isStrongPassword, {
        message: "Password must be at least 8 characters and include a letter and a number",
    }),
});
router.post("/reset-password", rateLimit_1.authLimiter, (0, validate_1.validateBody)(resetSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const hash = (0, jwt_1.hashToken)(req.body.token);
    const record = await prisma_1.prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new errorHandler_1.ApiError(400, "This reset link is invalid or has expired");
    }
    const passwordHash = await (0, password_1.hashPassword)(req.body.newPassword);
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({ where: { id: record.userId }, data: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null } }),
        prisma_1.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
        prisma_1.prisma.refreshToken.updateMany({
            where: { userId: record.userId, revokedAt: null },
            data: { revokedAt: new Date() },
        }),
    ]);
    (0, audit_1.recordAudit)(req, { action: "auth.password.reset", entityType: "User", entityId: record.userId });
    res.json({ ok: true });
}));
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().refine(password_1.isStrongPassword, {
        message: "Password must be at least 8 characters and include a letter and a number",
    }),
});
router.post("/change-password", auth_1.authenticate, (0, validate_1.validateBody)(changePasswordSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const valid = await (0, password_1.verifyPassword)(req.body.currentPassword, user.passwordHash);
    if (!valid)
        throw new errorHandler_1.ApiError(400, "Current password is incorrect");
    const passwordHash = await (0, password_1.hashPassword)(req.body.newPassword);
    await prisma_1.prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    (0, audit_1.recordAudit)(req, { action: "auth.password.changed", entityType: "User", entityId: user.id });
    res.json({ ok: true });
}));
exports.default = router;
