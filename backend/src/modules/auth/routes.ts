import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authLimiter } from "../../middleware/rateLimit";
import { authenticate } from "../../middleware/auth";
import { hashPassword, verifyPassword, isStrongPassword } from "../../utils/password";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
} from "../../utils/jwt";
import { sendMail } from "../../lib/mailer";
import { recordAudit } from "../../utils/audit";
import { effectivePermissions } from "../../shared";
import { env, isProd } from "../../env";

const router = Router();

const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  domain: env.COOKIE_DOMAIN,
};

async function issueSession(res: import("express").Response, userId: string, role: any, permissions: any) {
  const accessToken = signAccessToken({ sub: userId, role, permissions });
  const { token: refreshToken, hash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: { userId, tokenHash: hash, expiresAt: refreshTokenExpiry() },
  });

  res.cookie("access_token", accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie("refresh_token", refreshToken, {
    ...cookieOpts,
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw new ApiError(401, "Invalid email or password");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      recordAudit(req, { action: "auth.login.failed", entityType: "User", entityId: user.id });
      throw new ApiError(401, "Invalid email or password");
    }

    await issueSession(res, user.id, user.role, user.permissions);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    req.user = { id: user.id, role: user.role, permissions: user.permissions as any };
    recordAudit(req, { action: "auth.login.success", entityType: "User", entityId: user.id });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        permissions: effectivePermissions({ role: user.role, permissions: user.permissions as any }),
      },
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new ApiError(401, "Not authenticated");

    const hash = hashToken(token);
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new ApiError(401, "Session expired, please log in again");
    }

    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive) throw new ApiError(401, "Account is not active");

    // Rotate: revoke the used refresh token, issue a fresh pair.
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    await issueSession(res, user.id, user.role, user.permissions);

    res.json({ ok: true });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refresh_token as string | undefined;
    if (token) {
      const hash = hashToken(token);
      await prisma.refreshToken.updateMany({ where: { tokenHash: hash }, data: { revokedAt: new Date() } });
    }
    res.clearCookie("access_token", cookieOpts);
    res.clearCookie("refresh_token", cookieOpts);
    res.json({ ok: true });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { branch: true, staffProfile: true },
    });
    if (!user || !user.isActive) throw new ApiError(401, "Account is not active");

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
        permissions: effectivePermissions({ role: user.role, permissions: user.permissions as any }),
      },
    });
  })
);

const forgotSchema = z.object({ email: z.string().email() });

router.post(
  "/forgot-password",
  authLimiter,
  validateBody(forgotSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });

    // Always respond 200 to avoid leaking which emails are registered.
    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString("hex");
      const hash = hashToken(token);
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });

      const resetUrl = `${env.WEB_APP_URL}/reset-password?token=${token}`;
      await sendMail({
        to: user.email,
        subject: "Reset your VIP Mobiles admin password",
        text: `Hi ${user.name},\n\nReset your password using this link (valid 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
      });
      recordAudit(req, { action: "auth.password.forgot", entityType: "User", entityId: user.id });
    }

    res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
  })
);

const resetSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().refine(isStrongPassword, {
    message: "Password must be at least 8 characters and include a letter and a number",
  }),
});

router.post(
  "/reset-password",
  authLimiter,
  validateBody(resetSchema),
  asyncHandler(async (req, res) => {
    const hash = hashToken(req.body.token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ApiError(400, "This reset link is invalid or has expired");
    }

    const passwordHash = await hashPassword(req.body.newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    recordAudit(req, { action: "auth.password.reset", entityType: "User", entityId: record.userId });
    res.json({ ok: true });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().refine(isStrongPassword, {
    message: "Password must be at least 8 characters and include a letter and a number",
  }),
});

router.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const valid = await verifyPassword(req.body.currentPassword, user.passwordHash);
    if (!valid) throw new ApiError(400, "Current password is incorrect");

    const passwordHash = await hashPassword(req.body.newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    recordAudit(req, { action: "auth.password.changed", entityType: "User", entityId: user.id });

    res.json({ ok: true });
  })
);

export default router;
