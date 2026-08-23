"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
const shared_1 = require("@vip/shared");
const router = (0, express_1.Router)();
router.get("/", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const includeInactive = req.query.all === "1";
    const branches = await prisma_1.prisma.branch.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
            staffProfiles: {
                where: { displayOnSite: true },
                include: { user: { select: { name: true, avatarUrl: true } } },
                orderBy: { sortOrder: "asc" },
            },
        },
    });
    res.json({ branches });
}));
router.get("/:slug", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const branch = await prisma_1.prisma.branch.findUnique({
        where: { slug: req.params.slug },
        include: {
            staffProfiles: {
                where: { displayOnSite: true },
                include: { user: { select: { name: true, avatarUrl: true } } },
                orderBy: { sortOrder: "asc" },
            },
        },
    });
    if (!branch)
        throw new errorHandler_1.ApiError(404, "Branch not found");
    res.json({ branch });
}));
const branchSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(150),
    address: zod_1.z.string().min(1).max(300),
    city: zod_1.z.string().min(1).max(120),
    state: zod_1.z.string().optional().nullable(),
    country: zod_1.z.string().optional().nullable(),
    lat: zod_1.z.number().optional().nullable(),
    lng: zod_1.z.number().optional().nullable(),
    mapUrl: zod_1.z.string().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    whatsapp: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().email().optional().nullable(),
    openingHours: zod_1.z.record(zod_1.z.string()).optional().nullable(),
    imageUrl: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().optional(),
    metaTitle: zod_1.z.string().max(200).optional().nullable(),
    metaDescription: zod_1.z.string().max(320).optional().nullable(),
});
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.BRANCHES_MANAGE), (0, validate_1.validateBody)(branchSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const slug = (0, shared_1.slugify)(req.body.name);
    const branch = await prisma_1.prisma.branch.create({ data: { ...req.body, slug } });
    await (0, audit_1.recordAudit)(req, { action: "branch.created", entityType: "Branch", entityId: branch.id });
    res.status(201).json({ branch });
}));
router.patch("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.BRANCHES_MANAGE), (0, validate_1.validateBody)(branchSchema.partial()), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const data = { ...req.body };
    if (req.body.name)
        data.slug = (0, shared_1.slugify)(req.body.name);
    const branch = await prisma_1.prisma.branch.update({ where: { id: req.params.id }, data });
    await (0, audit_1.recordAudit)(req, { action: "branch.updated", entityType: "Branch", entityId: branch.id });
    res.json({ branch });
}));
router.delete("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.BRANCHES_MANAGE), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const count = await prisma_1.prisma.product.count({ where: { branchId: req.params.id } });
    if (count > 0)
        throw new errorHandler_1.ApiError(400, "Cannot delete a branch that still has products assigned.");
    await prisma_1.prisma.branch.delete({ where: { id: req.params.id } });
    await (0, audit_1.recordAudit)(req, { action: "branch.deleted", entityType: "Branch", entityId: req.params.id });
    res.json({ ok: true });
}));
exports.default = router;
