"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const upload_1 = require("../../middleware/upload");
const image_1 = require("../../utils/image");
const audit_1 = require("../../utils/audit");
const notifications_1 = require("../../utils/notifications");
const shared_1 = require("../../shared");
const env_1 = require("../../env");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
/** Own sale, or has the cross-staff view permission — same rule the list/analytics endpoints already use. */
async function loadOwnedSale(req, id) {
    const sale = await prisma_1.prisma.sale.findUnique({ where: { id } });
    if (!sale)
        throw new errorHandler_1.ApiError(404, "Sale not found");
    const canAccessAll = (0, shared_1.hasPermission)(req.user, shared_1.PERMISSIONS.SALES_VIEW_ALL);
    if (!canAccessAll && sale.staffId !== req.user.id) {
        throw new errorHandler_1.ApiError(403, "You do not have access to this sale");
    }
    return sale;
}
/** Purchase cost and profit are financial data — only SALES_ANALYTICS holders get them back in API responses. */
function stripCost(sale, canSeeCost) {
    if (canSeeCost)
        return sale;
    return { ...sale, costPrice: null, profit: null };
}
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
    if (product.status === "SOLD")
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
    // A completed sale is the natural end of any Buy Request for the same
    // product — close them out and drop a "sale completed" entry into their
    // timeline so staff aren't left with a stale, still-open request.
    const openBuyRequests = await prisma_1.prisma.buyRequest.findMany({
        where: { productId: product.id, status: { notIn: ["REJECTED", "CANCELLED", "CLOSED"] } },
    });
    for (const br of openBuyRequests) {
        await prisma_1.prisma.buyRequest.update({ where: { id: br.id }, data: { status: "CLOSED" } });
        (0, audit_1.recordAudit)(req, {
            action: "buyRequest.saleCompleted",
            entityType: "BuyRequest",
            entityId: br.id,
            meta: { previousStatus: br.status, newStatus: "CLOSED", saleId: sale.id, soldPrice: req.body.soldPrice },
        });
        if (br.assignedToId && br.assignedToId !== req.user.id) {
            (0, notifications_1.notifyUser)({
                userId: br.assignedToId,
                type: "BUY_REQUEST_STATUS_CHANGED",
                title: "Sale Completed",
                message: `${product.title} was sold — this buy request is now closed`,
                link: `/admin/buy-requests?id=${br.id}`,
            });
        }
    }
    (0, notifications_1.notifyUsersWithPermission)(shared_1.PERMISSIONS.SALES_ANALYTICS, {
        type: "SALE_COMPLETED",
        title: "Sale Completed",
        message: `${product.title} sold for ${req.body.soldPrice}`,
        link: `/admin/sales`,
    }, req.user.id);
    res.status(201).json({ sale: stripCost(sale, (0, shared_1.hasPermission)(req.user, shared_1.PERMISSIONS.SALES_ANALYTICS)) });
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
    const canSeeCost = (0, shared_1.hasPermission)(req.user, shared_1.PERMISSIONS.SALES_ANALYTICS);
    const [items, total] = await Promise.all([
        prisma_1.prisma.sale.findMany({
            where,
            include: {
                product: { select: { id: true, title: true, slug: true, condition: true } },
                branch: { select: { id: true, name: true } },
                staff: { select: { id: true, name: true } },
                unit: { select: { id: true, imei1: true, imei2: true, qrCode: true } },
            },
            orderBy: { saleDate: "desc" },
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
        prisma_1.prisma.sale.count({ where }),
    ]);
    res.json({
        items: items.map((s) => stripCost(s, canSeeCost)),
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
    });
}));
router.get("/analytics", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SALES_ANALYTICS), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const sales = await prisma_1.prisma.sale.findMany({
        where: { saleDate: { gte: from, lte: to } },
        include: {
            product: { select: { brandId: true, categoryId: true, title: true, condition: true, brand: { select: { name: true } }, category: { select: { name: true } } } },
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
    let newCount = 0;
    let usedCount = 0;
    let todayCount = 0;
    let todayRevenue = 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    for (const s of sales) {
        const branchKey = s.branchId ?? "unassigned";
        const branchEntry = byBranch.get(branchKey) ?? { branchId: s.branchId, name: s.branch?.name ?? "Unassigned", count: 0, revenue: 0, profit: 0 };
        branchEntry.count++;
        branchEntry.revenue += Number(s.soldPrice);
        branchEntry.profit += Number(s.profit ?? 0);
        byBranch.set(branchKey, branchEntry);
        const staffEntry = byStaff.get(s.staffId) ?? { staffId: s.staffId, name: s.staff.name, count: 0, revenue: 0, profit: 0 };
        staffEntry.count++;
        staffEntry.revenue += Number(s.soldPrice);
        staffEntry.profit += Number(s.profit ?? 0);
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
        if (s.product.condition === "NEW")
            newCount++;
        else
            usedCount++;
        if (dateKey === todayKey) {
            todayCount++;
            todayRevenue += Number(s.soldPrice);
        }
    }
    res.json({
        range: { from, to },
        totals: { count: sales.length, revenue: totalRevenue, profit: totalProfit },
        today: { count: todayCount, revenue: todayRevenue },
        conditionSplit: { new: newCount, used: usedCount },
        byBranch: Array.from(byBranch.values()).sort((a, b) => b.revenue - a.revenue),
        byStaff: Array.from(byStaff.values()).sort((a, b) => b.revenue - a.revenue),
        bestSellingBrands: Array.from(byBrand.values()).sort((a, b) => b.count - a.count).slice(0, 10),
        byDate: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
    });
}));
// Threshold shared with the storefront's LOW_STOCK badge (packages/shared/src/utils.ts).
const LOW_STOCK_THRESHOLD = 3;
router.get("/inventory-stats", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SALES_ANALYTICS), (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const [available, reserved, sold, hidden, valueAgg, unitsInStock, unitsSold, costAgg, profitAgg, allTrackedGroups, inStockGroups] = await Promise.all([
        prisma_1.prisma.product.count({ where: { status: "AVAILABLE" } }),
        prisma_1.prisma.product.count({ where: { status: "RESERVED" } }),
        prisma_1.prisma.product.count({ where: { status: "SOLD" } }),
        prisma_1.prisma.product.count({ where: { status: "HIDDEN" } }),
        prisma_1.prisma.product.aggregate({ where: { status: { in: ["AVAILABLE", "RESERVED"] } }, _sum: { basePrice: true } }),
        prisma_1.prisma.inventoryUnit.count({ where: { status: "IN_STOCK" } }),
        prisma_1.prisma.inventoryUnit.count({ where: { status: "SOLD" } }),
        prisma_1.prisma.inventoryUnit.aggregate({ where: { status: "IN_STOCK" }, _sum: { purchasePrice: true } }),
        prisma_1.prisma.sale.aggregate({ _sum: { profit: true } }),
        // Every product that has ever had a unit scanned in, regardless of
        // current status — the universe of "unit-tracked" products.
        prisma_1.prisma.inventoryUnit.groupBy({ by: ["productId"] }),
        // Same, but only counting units still IN_STOCK — a product present
        // in allTrackedGroups but absent here has sold out completely.
        prisma_1.prisma.inventoryUnit.groupBy({ by: ["productId"], where: { status: "IN_STOCK" }, _count: { _all: true } }),
    ]);
    const inStockByProduct = new Map(inStockGroups.map((g) => [g.productId, g._count._all]));
    const lowStockProducts = inStockGroups.filter((g) => g._count._all > 0 && g._count._all <= LOW_STOCK_THRESHOLD).length;
    const outOfStockTrackedProducts = allTrackedGroups.filter((g) => !inStockByProduct.has(g.productId)).length;
    res.json({
        counts: { available, reserved, sold, hidden, total: available + reserved + sold + hidden },
        availableInventoryValue: valueAgg._sum.basePrice ?? 0,
        // Serialized (IMEI/QR-scanned) inventory specifically.
        units: {
            inStock: unitsInStock,
            sold: unitsSold,
            totalCostValue: costAgg._sum.purchasePrice ?? 0,
            totalProfit: profitAgg._sum.profit ?? 0,
            lowStockProducts,
            outOfStockProducts: outOfStockTrackedProducts,
        },
    });
}));
// Bill/invoice photo — kept private (never exposed on the public storefront),
// viewable only to the sale's own staff or SALES_VIEW_ALL holders via loadOwnedSale.
router.post("/:id/bill", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SALES_RECORD), upload_1.imageUpload.single("bill"), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const sale = await loadOwnedSale(req, req.params.id);
    if (!req.file)
        throw new errorHandler_1.ApiError(400, "No image was uploaded");
    const { url } = await (0, image_1.processGenericImage)(req.file.buffer, "sales-bills", 1600);
    const updated = await prisma_1.prisma.sale.update({ where: { id: sale.id }, data: { billUrl: url } });
    (0, audit_1.recordAudit)(req, { action: "sale.bill.uploaded", entityType: "Sale", entityId: sale.id });
    res.json({ sale: updated });
}));
// Get-or-create the review link for this sale. Idempotent — a QR code once
// printed/shared must keep working, so re-requesting returns the same token
// rather than rotating it.
router.post("/:id/review-link", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SALES_RECORD), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const sale = await loadOwnedSale(req, req.params.id);
    let token = sale.reviewToken;
    if (!token) {
        token = crypto_1.default.randomBytes(24).toString("base64url");
        await prisma_1.prisma.sale.update({ where: { id: sale.id }, data: { reviewToken: token } });
    }
    res.json({
        token,
        reviewUrl: `${env_1.env.WEB_APP_URL}/review/${token}`,
        alreadySubmitted: !!sale.reviewSubmittedAt,
    });
}));
// PNG QR code for the review link — a plain <img src> so it prints reliably
// with no client-side rendering dependency (works on any device/connection).
router.get("/:id/review-qr.png", (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SALES_RECORD), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const sale = await loadOwnedSale(req, req.params.id);
    if (!sale.reviewToken)
        throw new errorHandler_1.ApiError(400, "Generate the review link first");
    const reviewUrl = `${env_1.env.WEB_APP_URL}/review/${sale.reviewToken}`;
    const png = await qrcode_1.default.toBuffer(reviewUrl, { type: "png", width: 480, margin: 1 });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(png);
}));
exports.default = router;
