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
const auth_1 = require("../../middleware/auth");
const password_1 = require("../../utils/password");
const jwt_1 = require("../../utils/jwt");
const mailer_1 = require("../../lib/mailer");
const audit_1 = require("../../utils/audit");
const shared_1 = require("@vip/shared");
const env_1 = require("../../env");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const roleEnum = zod_1.z.enum([
    shared_1.ROLES.SUPER_ADMIN,
    shared_1.ROLES.ADMIN,
    shared_1.ROLES.SALES_MANAGER,
    shared_1.ROLES.SALES_STAFF,
    shared_1.ROLES.CONTENT_MANAGER,
]);
router.get("/", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.STAFF_VIEW), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const users = await prisma_1.prisma.user.findMany({
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
            permissions: (0, shared_1.effectivePermissions)({ role: u.role, permissions: u.permissions }),
        })),
    });
}));
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(150),
    email: zod_1.z.string().email(),
    role: roleEnum,
    branchId: zod_1.z.string().optional().nullable(),
    position: zod_1.z.string().max(150).optional(),
});
router.post("/", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.STAFF_MANAGE), (0, validate_1.validateBody)(createUserSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (req.body.role === shared_1.ROLES.SUPER_ADMIN && req.user.role !== shared_1.ROLES.SUPER_ADMIN) {
        throw new errorHandler_1.ApiError(403, "Only a Super Admin can create another Super Admin");
    }
    const existing = await prisma_1.prisma.user.findUnique({ where: { email: req.body.email } });
    if (existing)
        throw new errorHandler_1.ApiError(409, "A user with this email already exists");
    const tempPassword = crypto_1.default.randomBytes(24).toString("hex");
    const passwordHash = await (0, password_1.hashPassword)(tempPassword);
    const user = await prisma_1.prisma.user.create({
        data: {
            name: req.body.name,
            email: req.body.email,
            role: req.body.role,
            passwordHash,
            branchId: req.body.branchId || null,
            staffProfile: req.body.position ? { create: { position: req.body.position } } : undefined,
        },
    });
    const token = crypto_1.default.randomBytes(32).toString("hex");
    await prisma_1.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: (0, jwt_1.hashToken)(token), expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) },
    });
    const setupUrl = `${env_1.env.WEB_APP_URL}/reset-password?token=${token}`;
    await (0, mailer_1.sendMail)({
        to: user.email,
        subject: "You've been added to the VIP Mobiles dashboard",
        text: `Hi ${user.name},\n\nAn account has been created for you with the role "${user.role}".\nSet your password to get started (valid 72 hours):\n${setupUrl}`,
    });
    await (0, audit_1.recordAudit)(req, { action: "user.created", entityType: "User", entityId: user.id, meta: { role: user.role } });
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(150).optional(),
    role: roleEnum.optional(),
    branchId: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
    position: zod_1.z.string().max(150).optional(),
    permissionGrants: zod_1.z.array(zod_1.z.string()).optional(),
    permissionRevokes: zod_1.z.array(zod_1.z.string()).optional(),
});
router.patch("/:id", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.STAFF_MANAGE), (0, validate_1.validateBody)(updateUserSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const target = await prisma_1.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target)
        throw new errorHandler_1.ApiError(404, "User not found");
    const body = req.body;
    const wantsRoleChange = body.role && body.role !== target.role;
    const wantsPermissionOverride = body.permissionGrants || body.permissionRevokes;
    if ((wantsRoleChange && (body.role === shared_1.ROLES.SUPER_ADMIN || target.role === shared_1.ROLES.SUPER_ADMIN)) ||
        wantsPermissionOverride) {
        if (req.user.role !== shared_1.ROLES.SUPER_ADMIN) {
            throw new errorHandler_1.ApiError(403, "Only a Super Admin can change role/permission overrides for this account");
        }
    }
    const permissions = body.permissionGrants || body.permissionRevokes
        ? { grant: body.permissionGrants ?? [], revoke: body.permissionRevokes ?? [] }
        : undefined;
    const updated = await prisma_1.prisma.user.update({
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
    await (0, audit_1.recordAudit)(req, { action: "user.updated", entityType: "User", entityId: updated.id, meta: body });
    res.json({
        user: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            role: updated.role,
            isActive: updated.isActive,
        },
    });
}));
router.delete("/:id", auth_1.requireSuperAdmin, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const target = await prisma_1.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target)
        throw new errorHandler_1.ApiError(404, "User not found");
    if (target.id === req.user.id)
        throw new errorHandler_1.ApiError(400, "You cannot delete your own account");
    await prisma_1.prisma.user.delete({ where: { id: target.id } });
    await (0, audit_1.recordAudit)(req, { action: "user.deleted", entityType: "User", entityId: target.id });
    res.json({ ok: true });
}));
exports.default = router;
