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
    const brands = await prisma_1.prisma.brand.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { products: true } } },
    });
    res.json({ brands });
}));
router.get("/:slug", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const brand = await prisma_1.prisma.brand.findUnique({ where: { slug: req.params.slug } });
    if (!brand)
        throw new errorHandler_1.ApiError(404, "Brand not found");
    res.json({ brand });
}));
const brandSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(120),
    logoUrl: zod_1.z.string().optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().optional(),
    metaTitle: zod_1.z.string().max(200).optional().nullable(),
    metaDescription: zod_1.z.string().max(320).optional().nullable(),
});
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CATALOG_MANAGE_BRANDS), (0, validate_1.validateBody)(brandSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const slug = (0, shared_1.slugify)(req.body.name);
    const brand = await prisma_1.prisma.brand.create({ data: { ...req.body, slug } });
    await (0, audit_1.recordAudit)(req, { action: "brand.created", entityType: "Brand", entityId: brand.id });
    res.status(201).json({ brand });
}));
router.patch("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CATALOG_MANAGE_BRANDS), (0, validate_1.validateBody)(brandSchema.partial()), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const data = { ...req.body };
    if (req.body.name)
        data.slug = (0, shared_1.slugify)(req.body.name);
    const brand = await prisma_1.prisma.brand.update({ where: { id: req.params.id }, data });
    await (0, audit_1.recordAudit)(req, { action: "brand.updated", entityType: "Brand", entityId: brand.id });
    res.json({ brand });
}));
router.delete("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CATALOG_MANAGE_BRANDS), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const count = await prisma_1.prisma.product.count({ where: { brandId: req.params.id } });
    if (count > 0)
        throw new errorHandler_1.ApiError(400, "Cannot delete a brand that still has products. Reassign or remove them first.");
    await prisma_1.prisma.brand.delete({ where: { id: req.params.id } });
    await (0, audit_1.recordAudit)(req, { action: "brand.deleted", entityType: "Brand", entityId: req.params.id });
    res.json({ ok: true });
}));
exports.default = router;
