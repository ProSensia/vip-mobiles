import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission, requireSuperAdmin } from "../../middleware/auth";
import { hashPassword } from "../../utils/password";
import { hashToken } from "../../utils/jwt";
import { sendMail } from "../../lib/mailer";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS, ROLES, effectivePermissions } from "@vip/shared";
import { env } from "../../env";

const router = Router();
router.use(authenticate);

const roleEnum = z.enum([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.SALES_MANAGER,
  ROLES.SALES_STAFF,
  ROLES.CONTENT_MANAGER,
]);

router.get(
  "/",
  requirePermission(PERMISSIONS.STAFF_VIEW),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { branch: { select: { id: true, name: true } }, staffProfile: true },
    });
    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        isDemo: u.isDemo,
        branch: u.branch,
        position: u.staffProfile?.position ?? null,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        permissions: effectivePermissions({ role: u.role, permissions: u.permissions as any }),
      })),
    });
  })
);

const createUserSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email(),
  role: roleEnum,
  branchId: z.string().optional().nullable(),
  position: z.string().max(150).optional(),
});

router.post(
  "/",
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    if (req.body.role === ROLES.SUPER_ADMIN && req.user!.role !== ROLES.SUPER_ADMIN) {
      throw new ApiError(403, "Only a Super Admin can create another Super Admin");
    }

    const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (existing) throw new ApiError(409, "A user with this email already exists");

    const tempPassword = crypto.randomBytes(24).toString("hex");
    const passwordHash = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        role: req.body.role,
        passwordHash,
        branchId: req.body.branchId || null,
        staffProfile: req.body.position ? { create: { position: req.body.position } } : undefined,
      },
    });

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) },
    });
    const setupUrl = `${env.WEB_APP_URL}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: "You've been added to the VIP Mobiles dashboard",
      text: `Hi ${user.name},\n\nAn account has been created for you with the role "${user.role}".\nSet your password to get started (valid 72 hours):\n${setupUrl}`,
    });

    await recordAudit(req, { action: "user.created", entityType: "User", entityId: user.id, meta: { role: user.role } });
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  })
);

const updateUserSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  role: roleEnum.optional(),
  branchId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  position: z.string().max(150).optional(),
  permissionGrants: z.array(z.string()).optional(),
  permissionRevokes: z.array(z.string()).optional(),
});

router.patch(
  "/:id",
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new ApiError(404, "User not found");

    const body = req.body;
    const wantsRoleChange = body.role && body.role !== target.role;
    const wantsPermissionOverride = body.permissionGrants || body.permissionRevokes;

    if ((wantsRoleChange && (body.role === ROLES.SUPER_ADMIN || target.role === ROLES.SUPER_ADMIN)) ||
      wantsPermissionOverride) {
      if (req.user!.role !== ROLES.SUPER_ADMIN) {
        throw new ApiError(403, "Only a Super Admin can change role/permission overrides for this account");
      }
    }

    const permissions =
      body.permissionGrants || body.permissionRevokes
        ? { grant: body.permissionGrants ?? [], revoke: body.permissionRevokes ?? [] }
        : undefined;

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        name: body.name,
        role: body.role,
        branchId: body.branchId === undefined ? undefined : body.branchId || null,
        isActive: body.isActive,
        permissions,
        staffProfile: body.position
          ? { upsert: { create: { position: body.position }, update: { position: body.position } } }
          : undefined,
      },
    });

    await recordAudit(req, { action: "user.updated", entityType: "User", entityId: updated.id, meta: body });
    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
      },
    });
  })
);

router.delete(
  "/:id",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new ApiError(404, "User not found");
    if (target.id === req.user!.id) throw new ApiError(400, "You cannot delete your own account");

    await prisma.user.delete({ where: { id: target.id } });
    await recordAudit(req, { action: "user.deleted", entityType: "User", entityId: target.id });
    res.json({ ok: true });
  })
);

export default router;
