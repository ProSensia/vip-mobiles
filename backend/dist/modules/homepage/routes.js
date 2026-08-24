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
router.get("/", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const includeHidden = req.query.all === "1" && !!req.user;
    const sections = await prisma_1.prisma.homepageSection.findMany({
        where: includeHidden ? undefined : { isVisible: true },
        orderBy: { sortOrder: "asc" },
    });
    res.json({ sections });
}));
const sectionSchema = zod_1.z.object({
    type: zod_1.z.enum([
        "FEATURED_PRODUCTS",
        "NEW_ARRIVALS",
        "FEATURED_CATEGORIES",
        "SELECTED_PRODUCTS",
        "BANNER",
        "BRANCHES",
        "CUSTOM_HTML",
    ]),
    title: zod_1.z.string().max(200).optional().nullable(),
    subtitle: zod_1.z.string().max(300).optional().nullable(),
    config: zod_1.z.record(zod_1.z.any()).optional().nullable(),
    isVisible: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().optional(),
});
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CONTENT_HOMEPAGE), (0, validate_1.validateBody)(sectionSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const count = await prisma_1.prisma.homepageSection.count();
    const section = await prisma_1.prisma.homepageSection.create({
        data: { ...req.body, sortOrder: req.body.sortOrder ?? count },
    });
    (0, audit_1.recordAudit)(req, { action: "homepage.section.created", entityType: "HomepageSection", entityId: section.id });
    res.status(201).json({ section });
}));
router.patch("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CONTENT_HOMEPAGE), (0, validate_1.validateBody)(sectionSchema.partial()), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const section = await prisma_1.prisma.homepageSection.update({ where: { id: req.params.id }, data: req.body });
    (0, audit_1.recordAudit)(req, { action: "homepage.section.updated", entityType: "HomepageSection", entityId: section.id });
    res.json({ section });
}));
const reorderSchema = zod_1.z.object({ order: zod_1.z.array(zod_1.z.string()).min(1) });
router.patch("/reorder", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CONTENT_HOMEPAGE), (0, validate_1.validateBody)(reorderSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.$transaction(req.body.order.map((id, index) => prisma_1.prisma.homepageSection.update({ where: { id }, data: { sortOrder: index } })));
    res.json({ ok: true });
}));
router.delete("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CONTENT_HOMEPAGE), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.homepageSection.delete({ where: { id: req.params.id } });
    (0, audit_1.recordAudit)(req, { action: "homepage.section.deleted", entityType: "HomepageSection", entityId: req.params.id });
    res.json({ ok: true });
}));
exports.default = router;
