"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
const shared_1 = require("../../shared");
const router = (0, express_1.Router)();
router.get("/", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const colors = await prisma_1.prisma.color.findMany({ orderBy: { name: "asc" } });
    res.json({ colors });
}));
const colorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(60),
    hexCode: zod_1.z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/),
});
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CATALOG_MANAGE_COLORS), (0, validate_1.validateBody)(colorSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const color = await prisma_1.prisma.color.create({ data: req.body });
    await (0, audit_1.recordAudit)(req, { action: "color.created", entityType: "Color", entityId: color.id });
    res.status(201).json({ color });
}));
router.patch("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CATALOG_MANAGE_COLORS), (0, validate_1.validateBody)(colorSchema.partial()), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const color = await prisma_1.prisma.color.update({ where: { id: req.params.id }, data: req.body });
    await (0, audit_1.recordAudit)(req, { action: "color.updated", entityType: "Color", entityId: color.id });
    res.json({ color });
}));
router.delete("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CATALOG_MANAGE_COLORS), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const usage = await prisma_1.prisma.productVariant.count({ where: { colorId: req.params.id } });
    if (usage > 0)
        throw new errorHandler_1.ApiError(400, "Cannot delete a color still used by product variants.");
    await prisma_1.prisma.color.delete({ where: { id: req.params.id } });
    await (0, audit_1.recordAudit)(req, { action: "color.deleted", entityType: "Color", entityId: req.params.id });
    res.json({ ok: true });
}));
exports.default = router;
