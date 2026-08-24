import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import QRCode from "qrcode";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { imageUpload } from "../../middleware/upload";
import { processGenericImage } from "../../utils/image";
import { recordAudit } from "../../utils/audit";
import { notifyUser, notifyUsersWithPermission } from "../../utils/notifications";
import { hasPermission, PERMISSIONS } from "../../shared";
import { env } from "../../env";

const router = Router();
router.use(authenticate);

/** Own sale, or has the cross-staff view permission — same rule the list/analytics endpoints already use. */
async function loadOwnedSale(req: import("express").Request, id: string) {
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) throw new ApiError(404, "Sale not found");
  const canAccessAll = hasPermission(req.user!, PERMISSIONS.SALES_VIEW_ALL);
  if (!canAccessAll && sale.staffId !== req.user!.id) {
    throw new ApiError(403, "You do not have access to this sale");
  }
  return sale;
}

const createSaleSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  soldPrice: z.coerce.number().positive(),
  costPrice: z.coerce.number().positive().optional().nullable(),
  customerName: z.string().max(150).optional().nullable(),
  customerContact: z.string().max(150).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  staffId: z.string().optional(), // only honored for managers/admins
});

router.post(
  "/",
  requirePermission(PERMISSIONS.SALES_RECORD),
  validateBody(createSaleSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.body.productId } });
    if (!product) throw new ApiError(404, "Product not found");

    const existingSale = await prisma.sale.findUnique({ where: { productId: product.id } });
    if (existingSale) throw new ApiError(400, "This product has already been recorded as sold");

    const canAssignOthers = hasPermission(req.user!, PERMISSIONS.SALES_VIEW_ALL);
    const staffId = canAssignOthers && req.body.staffId ? req.body.staffId : req.user!.id;

    const profit =
      req.body.costPrice != null ? Number(req.body.soldPrice) - Number(req.body.costPrice) : null;

    const [sale] = await prisma.$transaction([
      prisma.sale.create({
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
      prisma.product.update({
        where: { id: product.id },
        data: { status: "SOLD", soldAt: new Date(), soldPrice: req.body.soldPrice, isFeatured: false },
      }),
      ...(req.body.variantId
        ? [prisma.productVariant.update({ where: { id: req.body.variantId }, data: { status: "SOLD" } })]
        : []),
    ]);

    recordAudit(req, { action: "sale.recorded", entityType: "Sale", entityId: sale.id, meta: { productId: product.id } });

    // A completed sale is the natural end of any Buy Request for the same
    // product — close them out and drop a "sale completed" entry into their
    // timeline so staff aren't left with a stale, still-open request.
    const openBuyRequests = await prisma.buyRequest.findMany({
      where: { productId: product.id, status: { notIn: ["REJECTED", "CANCELLED", "CLOSED"] } },
    });
    for (const br of openBuyRequests) {
      await prisma.buyRequest.update({ where: { id: br.id }, data: { status: "CLOSED" } });
      recordAudit(req, {
        action: "buyRequest.saleCompleted",
        entityType: "BuyRequest",
        entityId: br.id,
        meta: { previousStatus: br.status, newStatus: "CLOSED", saleId: sale.id, soldPrice: req.body.soldPrice },
      });
      if (br.assignedToId && br.assignedToId !== req.user!.id) {
        notifyUser({
          userId: br.assignedToId,
          type: "BUY_REQUEST_STATUS_CHANGED",
          title: "Sale Completed",
          message: `${product.title} was sold — this buy request is now closed`,
          link: `/admin/buy-requests?id=${br.id}`,
        });
      }
    }

    notifyUsersWithPermission(
      PERMISSIONS.SALES_ANALYTICS,
      {
        type: "SALE_COMPLETED",
        title: "Sale Completed",
        message: `${product.title} sold for ${req.body.soldPrice}`,
        link: `/admin/sales`,
      },
      req.user!.id
    );

    res.status(201).json({ sale });
  })
);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  branchId: z.string().optional(),
  staffId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

router.get(
  "/",
  requirePermission(PERMISSIONS.SALES_VIEW_OWN),
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const canViewAll = hasPermission(req.user!, PERMISSIONS.SALES_VIEW_ALL);

    const where: any = {
      ...(canViewAll ? {} : { staffId: req.user!.id }),
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(canViewAll && q.staffId ? { staffId: q.staffId } : {}),
      ...(q.from || q.to ? { saleDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.sale.findMany({
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
      prisma.sale.count({ where }),
    ]);

    res.json({ items, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) });
  })
);

router.get(
  "/analytics",
  requirePermission(PERMISSIONS.SALES_ANALYTICS),
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();

    const sales = await prisma.sale.findMany({
      where: { saleDate: { gte: from, lte: to } },
      include: {
        product: { select: { brandId: true, categoryId: true, title: true, brand: { select: { name: true } }, category: { select: { name: true } } } },
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.soldPrice), 0);
    const totalProfit = sales.reduce((sum, s) => sum + Number(s.profit ?? 0), 0);

    const byBranch = new Map<string, { branchId: string | null; name: string; count: number; revenue: number }>();
    const byStaff = new Map<string, { staffId: string; name: string; count: number; revenue: number }>();
    const byBrand = new Map<string, { name: string; count: number; revenue: number }>();
    const byDate = new Map<string, { date: string; count: number; revenue: number }>();

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
  })
);

router.get(
  "/inventory-stats",
  requirePermission(PERMISSIONS.SALES_ANALYTICS),
  asyncHandler(async (_req, res) => {
    const [available, reserved, sold, hidden, valueAgg] = await Promise.all([
      prisma.product.count({ where: { status: "AVAILABLE" } }),
      prisma.product.count({ where: { status: "RESERVED" } }),
      prisma.product.count({ where: { status: "SOLD" } }),
      prisma.product.count({ where: { status: "HIDDEN" } }),
      prisma.product.aggregate({ where: { status: { in: ["AVAILABLE", "RESERVED"] } }, _sum: { basePrice: true } }),
    ]);

    res.json({
      counts: { available, reserved, sold, hidden, total: available + reserved + sold + hidden },
      availableInventoryValue: valueAgg._sum.basePrice ?? 0,
    });
  })
);

// Bill/invoice photo — kept private (never exposed on the public storefront),
// viewable only to the sale's own staff or SALES_VIEW_ALL holders via loadOwnedSale.
router.post(
  "/:id/bill",
  requirePermission(PERMISSIONS.SALES_RECORD),
  imageUpload.single("bill"),
  asyncHandler(async (req, res) => {
    const sale = await loadOwnedSale(req, req.params.id);
    if (!req.file) throw new ApiError(400, "No image was uploaded");

    const { url } = await processGenericImage(req.file.buffer, "sales-bills", 1600);
    const updated = await prisma.sale.update({ where: { id: sale.id }, data: { billUrl: url } });
    recordAudit(req, { action: "sale.bill.uploaded", entityType: "Sale", entityId: sale.id });

    res.json({ sale: updated });
  })
);

// Get-or-create the review link for this sale. Idempotent — a QR code once
// printed/shared must keep working, so re-requesting returns the same token
// rather than rotating it.
router.post(
  "/:id/review-link",
  requirePermission(PERMISSIONS.SALES_RECORD),
  asyncHandler(async (req, res) => {
    const sale = await loadOwnedSale(req, req.params.id);

    let token = sale.reviewToken;
    if (!token) {
      token = crypto.randomBytes(24).toString("base64url");
      await prisma.sale.update({ where: { id: sale.id }, data: { reviewToken: token } });
    }

    res.json({
      token,
      reviewUrl: `${env.WEB_APP_URL}/review/${token}`,
      alreadySubmitted: !!sale.reviewSubmittedAt,
    });
  })
);

// PNG QR code for the review link — a plain <img src> so it prints reliably
// with no client-side rendering dependency (works on any device/connection).
router.get(
  "/:id/review-qr.png",
  requirePermission(PERMISSIONS.SALES_RECORD),
  asyncHandler(async (req, res) => {
    const sale = await loadOwnedSale(req, req.params.id);
    if (!sale.reviewToken) throw new ApiError(400, "Generate the review link first");

    const reviewUrl = `${env.WEB_APP_URL}/review/${sale.reviewToken}`;
    const png = await QRCode.toBuffer(reviewUrl, { type: "png", width: 480, margin: 1 });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(png);
  })
);

export default router;
