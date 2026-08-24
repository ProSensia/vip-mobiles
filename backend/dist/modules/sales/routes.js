"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
const notifications_1 = require("../../utils/notifications");
const shared_1 = require("../../shared");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const createSaleSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    variantId: zod_1.z.string().optional().nullable(),
    soldPrice: zod_1.z.coerce.number().positive(),
    costPrice: zod_1.z.coerce.number().positive().optional().nullable(),
    customerName: zod_1.z.string().max(150).optional().nullable(),
    customerContact: zod_1.z.string().max(150).optional().nullable(),
    notes: zod_1.z.string().max(1000).optional().nullable(),
    staffId: zod_1.z.string().optional(), // only honored for managers/admins
});
router.post("/", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SALES_RECORD), (0, validate_1.validateBody)(createSaleSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const product = await prisma_1.prisma.product.findUnique({ where: { id: req.body.productId } });
    if (!product)
        throw new errorHandler_1.ApiError(404, "Product not found");
    const existingSale = await prisma_1.prisma.sale.findUnique({ where: { productId: product.id } });
    if (existingSale)
        throw new errorHandler_1.ApiError(400, "This product has already been recorded as sold");
    const canAssignOthers = (0, shared_1.hasPermission)(req.user, shared_1.PERMISSIONS.SALES_VIEW_ALL);
    const staffId = canAssignOthers && req.body.staffId ? req.body.staffId : req.user.id;
    const profit = req.body.costPrice != null ? Number(req.body.soldPrice) - Number(req.body.costPrice) : null;
    const [sale] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.sale.create({
            data: {
                productId: product.id,
                variantId: req.body.variantId || null,
                branchId: product.branchId,
                staffId,
                soldPrice: req.body.soldPrice,
                costPrice: req.body.costPrice ?? null,
                profit: profit ?? undefined,
                customerName: req.body.customerName,
                customerContact: req.body.customerContact,
                notes: req.body.notes,
            },
        }),
        prisma_1.prisma.product.update({
            where: { id: product.id },
            data: { status: "SOLD", soldAt: new Date(), soldPrice: req.body.soldPrice, isFeatured: false },
        }),
        ...(req.body.variantId
            ? [prisma_1.prisma.productVariant.update({ where: { id: req.body.variantId }, data: { status: "SOLD" } })]
            : []),
    ]);
    (0, audit_1.recordAudit)(req, { action: "sale.recorded", entityType: "Sale", entityId: sale.id, meta: { productId: product.id } });
    (0, notifications_1.notifyUsersWithPermission)(shared_1.PERMISSIONS.SALES_ANALYTICS, {
        type: "SALE_COMPLETED",
        title: "Sale Completed",
        message: `${product.title} sold for ${req.body.soldPrice}`,
        link: `/admin/sales`,
    }, req.user.id);
    res.status(201).json({ sale });
}));
const listQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(25),
    branchId: zod_1.z.string().optional(),
    staffId: zod_1.z.string().optional(),
    from: zod_1.z.coerce.date().optional(),
    to: zod_1.z.coerce.date().optional(),
});
router.get("/", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SALES_VIEW_OWN), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const canViewAll = (0, shared_1.hasPermission)(req.user, shared_1.PERMISSIONS.SALES_VIEW_ALL);
    const where = {
        ...(canViewAll ? {} : { staffId: req.user.id }),
        ...(q.branchId ? { branchId: q.branchId } : {}),
        ...(canViewAll && q.staffId ? { staffId: q.staffId } : {}),
        ...(q.from || q.to ? { saleDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.sale.findMany({
            where,
            include: {
                product: { select: { id: true, title: true, slug: true } },
                branch: { select: { id: true, name: true } },
                staff: { select: { id: true, name: true } },
            },
            orderBy: { saleDate: "desc" },
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
        prisma_1.prisma.sale.count({ where }),
    ]);
    res.json({ items, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) });
}));
router.get("/analytics", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SALES_ANALYTICS), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const sales = await prisma_1.prisma.sale.findMany({
        where: { saleDate: { gte: from, lte: to } },
        include: {
            product: { select: { brandId: true, categoryId: true, title: true, brand: { select: { name: true } }, category: { select: { name: true } } } },
            branch: { select: { id: true, name: true } },
            staff: { select: { id: true, name: true } },
        },
    });
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.soldPrice), 0);
    const totalProfit = sales.reduce((sum, s) => sum + Number(s.profit ?? 0), 0);
    const byBranch = new Map();
    const byStaff = new Map();
    const byBrand = new Map();
    const byDate = new Map();
    for (const s of sales) {
        const branchKey = s.branchId ?? "unassigned";
        const branchEntry = byBranch.get(branchKey) ?? { branchId: s.branchId, name: s.branch?.name ?? "Unassigned", count: 0, revenue: 0 };
        branchEntry.count++;
        branchEntry.revenue += Number(s.soldPrice);
        byBranch.set(branchKey, branchEntry);
        const staffEntry = byStaff.get(s.staffId) ?? { staffId: s.staffId, name: s.staff.name, count: 0, revenue: 0 };
        staffEntry.count++;
        staffEntry.revenue += Number(s.soldPrice);
        byStaff.set(s.staffId, staffEntry);
        const brandName = s.product.brand?.name ?? "Unknown";
        const brandEntry = byBrand.get(brandName) ?? { name: brandName, count: 0, revenue: 0 };
        brandEntry.count++;
        brandEntry.revenue += Number(s.soldPrice);
        byBrand.set(brandName, brandEntry);
        const dateKey = s.saleDate.toISOString().slice(0, 10);
        const dateEntry = byDate.get(dateKey) ?? { date: dateKey, count: 0, revenue: 0 };
        dateEntry.count++;
        dateEntry.revenue += Number(s.soldPrice);
        byDate.set(dateKey, dateEntry);
    }
    res.json({
        range: { from, to },
        totals: { count: sales.length, revenue: totalRevenue, profit: totalProfit },
        byBranch: Array.from(byBranch.values()).sort((a, b) => b.revenue - a.revenue),
        byStaff: Array.from(byStaff.values()).sort((a, b) => b.revenue - a.revenue),
        bestSellingBrands: Array.from(byBrand.values()).sort((a, b) => b.count - a.count).slice(0, 10),
        byDate: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
    });
}));
router.get("/inventory-stats", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SALES_ANALYTICS), (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const [available, reserved, sold, hidden, valueAgg] = await Promise.all([
        prisma_1.prisma.product.count({ where: { status: "AVAILABLE" } }),
        prisma_1.prisma.product.count({ where: { status: "RESERVED" } }),
        prisma_1.prisma.product.count({ where: { status: "SOLD" } }),
        prisma_1.prisma.product.count({ where: { status: "HIDDEN" } }),
        prisma_1.prisma.product.aggregate({ where: { status: { in: ["AVAILABLE", "RESERVED"] } }, _sum: { basePrice: true } }),
    ]);
    res.json({
        counts: { available, reserved, sold, hidden, total: available + reserved + sold + hidden },
        availableInventoryValue: valueAgg._sum.basePrice ?? 0,
    });
}));
exports.default = router;
