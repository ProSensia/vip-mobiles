import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { uniqueProductSlug } from "../../utils/uniqueSlug";
import { PERMISSIONS } from "../../shared";

const router = Router();

const CONDITIONS = ["NEW", "USED", "REFURBISHED", "OPEN_BOX"] as const;
const STATUSES = ["AVAILABLE", "RESERVED", "SOLD", "HIDDEN"] as const;

// Column order shared by the template, export, and import parser — keeping
// one source of truth means a downloaded template always round-trips
// through import without a header mismatch.
const COLUMNS = [
  { header: "SKU", key: "sku", width: 16 },
  { header: "Title", key: "title", width: 32 },
  { header: "Brand", key: "brand", width: 18 },
  { header: "Category", key: "category", width: 18 },
  { header: "Branch", key: "branch", width: 18 },
  { header: "Condition", key: "condition", width: 14 },
  { header: "Status", key: "status", width: 12 },
  { header: "Base Price", key: "basePrice", width: 14 },
  { header: "Compare At Price", key: "compareAtPrice", width: 16 },
  { header: "Box Available", key: "boxAvailable", width: 14 },
  { header: "Featured", key: "isFeatured", width: 12 },
  { header: "New Arrival", key: "isNewArrival", width: 12 },
  { header: "Trending", key: "isTrending", width: 12 },
  { header: "Best Seller", key: "isBestSeller", width: 12 },
  { header: "PTA Approved", key: "isPtaApproved", width: 12 },
  { header: "Description", key: "description", width: 40 },
] as const;

const xlsxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      /\.xlsx$/i.test(file.originalname);
    if (!ok) {
      cb(new Error("Please upload a .xlsx file"));
      return;
    }
    cb(null, true);
  },
});

function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in (v as any)) return String((v as any).text ?? "").trim();
  if (typeof v === "object" && "result" in (v as any)) return String((v as any).result ?? "").trim();
  return String(v).trim();
}

router.get(
  "/import-template.xlsx",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_EDIT),
  asyncHandler(async (_req, res) => {
    const [brands, categories, branches] = await Promise.all([
      prisma.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.branch.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    ]);

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Products");
    sheet.columns = COLUMNS as any;
    sheet.addRow({
      sku: "IP14PM-256-BLK",
      title: "iPhone 14 Pro Max 256GB",
      brand: brands[0]?.name ?? "Apple",
      category: categories[0]?.name ?? "Smartphones",
      branch: branches[0]?.name ?? "",
      condition: "USED",
      status: "AVAILABLE",
      basePrice: 250000,
      compareAtPrice: "",
      boxAvailable: "TRUE",
      isFeatured: "FALSE",
      isNewArrival: "FALSE",
      isTrending: "FALSE",
      isBestSeller: "FALSE",
      isPtaApproved: "TRUE",
      description: "Example row — replace or delete before importing.",
    });

    const ref = wb.addWorksheet("Valid Values");
    ref.columns = [
      { header: "Brands", key: "brand", width: 22 },
      { header: "Categories", key: "category", width: 22 },
      { header: "Branches", key: "branch", width: 22 },
      { header: "Condition", key: "condition", width: 14 },
      { header: "Status", key: "status", width: 12 },
    ];
    const maxRows = Math.max(brands.length, categories.length, branches.length, CONDITIONS.length, STATUSES.length);
    for (let i = 0; i < maxRows; i++) {
      ref.addRow({
        brand: brands[i]?.name ?? "",
        category: categories[i]?.name ?? "",
        branch: branches[i]?.name ?? "",
        condition: CONDITIONS[i] ?? "",
        status: STATUSES[i] ?? "",
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="vip-mobiles-product-import-template.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  })
);

router.get(
  "/export.xlsx",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        sku: true,
        title: true,
        condition: true,
        status: true,
        basePrice: true,
        compareAtPrice: true,
        boxAvailable: true,
        isFeatured: true,
        isNewArrival: true,
        isTrending: true,
        isBestSeller: true,
        isPtaApproved: true,
        description: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Products");
    sheet.columns = COLUMNS as any;
    for (const p of products) {
      sheet.addRow({
        sku: p.sku ?? "",
        title: p.title,
        brand: p.brand.name,
        category: p.category.name,
        branch: p.branch?.name ?? "",
        condition: p.condition,
        status: p.status,
        basePrice: Number(p.basePrice),
        compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : "",
        boxAvailable: p.boxAvailable ? "TRUE" : "FALSE",
        isFeatured: p.isFeatured ? "TRUE" : "FALSE",
        isNewArrival: p.isNewArrival ? "TRUE" : "FALSE",
        isTrending: p.isTrending ? "TRUE" : "FALSE",
        isBestSeller: p.isBestSeller ? "TRUE" : "FALSE",
        isPtaApproved: p.isPtaApproved ? "TRUE" : "FALSE",
        description: p.description ?? "",
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="vip-mobiles-products-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  })
);

interface ParsedRow {
  row: number;
  sku: string | null;
  title: string;
  brandId: string;
  categoryId: string;
  branchId: string | null;
  condition: (typeof CONDITIONS)[number];
  status: (typeof STATUSES)[number];
  basePrice: number;
  compareAtPrice: number | null;
  boxAvailable: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  isPtaApproved: boolean;
  description: string | null;
}

interface RowError {
  row: number;
  message: string;
}

async function parseWorkbook(buffer: Buffer): Promise<{ rows: ParsedRow[]; errors: RowError[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new ApiError(400, "The uploaded file has no worksheet");

  const [brands, categories, branches] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.branch.findMany({ select: { id: true, name: true } }),
  ]);
  const brandByName = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const branchByName = new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));

  const headerRow = sheet.getRow(1);
  const colIndex = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const key = COLUMNS.find((c) => c.header.toLowerCase() === cellText(cell.value).toLowerCase())?.key;
    if (key) colIndex.set(key, colNumber);
  });
  if (!colIndex.has("title") || !colIndex.has("brand") || !colIndex.has("category") || !colIndex.has("basePrice")) {
    throw new ApiError(400, "This file doesn't match the expected template — download the current template and try again");
  }

  const get = (row: ExcelJS.Row, key: string) => {
    const idx = colIndex.get(key);
    return idx ? cellText(row.getCell(idx).value) : "";
  };

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const title = get(row, "title");
    const skuRaw = get(row, "sku");
    const brandName = get(row, "brand");
    const categoryName = get(row, "category");
    // A fully blank row (common at the end of a sheet) is silently skipped, not reported as an error.
    if (!title && !brandName && !categoryName && !skuRaw) return;

    const rowErrors: string[] = [];
    if (!title) rowErrors.push("Title is required");

    const brandId = brandByName.get(brandName.toLowerCase());
    if (!brandName) rowErrors.push("Brand is required");
    else if (!brandId) rowErrors.push(`Unknown brand "${brandName}"`);

    const categoryId = categoryByName.get(categoryName.toLowerCase());
    if (!categoryName) rowErrors.push("Category is required");
    else if (!categoryId) rowErrors.push(`Unknown category "${categoryName}"`);

    const branchName = get(row, "branch");
    const branchId = branchName ? branchByName.get(branchName.toLowerCase()) : undefined;
    if (branchName && !branchId) rowErrors.push(`Unknown branch "${branchName}"`);

    const conditionRaw = (get(row, "condition") || "USED").toUpperCase();
    const condition = CONDITIONS.includes(conditionRaw as any) ? (conditionRaw as (typeof CONDITIONS)[number]) : null;
    if (!condition) rowErrors.push(`Condition must be one of ${CONDITIONS.join(", ")}`);

    const statusRaw = (get(row, "status") || "AVAILABLE").toUpperCase();
    const status = STATUSES.includes(statusRaw as any) ? (statusRaw as (typeof STATUSES)[number]) : null;
    if (!status) rowErrors.push(`Status must be one of ${STATUSES.join(", ")}`);

    const basePriceRaw = get(row, "basePrice");
    const basePrice = Number(basePriceRaw);
    if (!basePriceRaw || !Number.isFinite(basePrice) || basePrice <= 0) rowErrors.push("Base Price must be a positive number");

    const compareAtRaw = get(row, "compareAtPrice");
    const compareAtPrice = compareAtRaw ? Number(compareAtRaw) : null;
    if (compareAtRaw && (!Number.isFinite(compareAtPrice) || (compareAtPrice as number) <= 0)) {
      rowErrors.push("Compare At Price must be a positive number");
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, message: rowErrors.join("; ") });
      return;
    }

    rows.push({
      row: rowNumber,
      sku: skuRaw || null,
      title,
      brandId: brandId!,
      categoryId: categoryId!,
      branchId: branchId ?? null,
      condition: condition!,
      status: status!,
      basePrice,
      compareAtPrice,
      boxAvailable: truthy(get(row, "boxAvailable")),
      isFeatured: truthy(get(row, "isFeatured")),
      isNewArrival: truthy(get(row, "isNewArrival")),
      isTrending: truthy(get(row, "isTrending")),
      isBestSeller: truthy(get(row, "isBestSeller")),
      isPtaApproved: truthy(get(row, "isPtaApproved")),
      description: get(row, "description") || null,
    });
  });

  // Two rows in the same file claiming the same SKU — flag as an error
  // rather than silently letting the second one win.
  const seenSku = new Map<string, number>();
  for (const r of rows) {
    if (!r.sku) continue;
    const prevRow = seenSku.get(r.sku.toLowerCase());
    if (prevRow) errors.push({ row: r.row, message: `Duplicate SKU "${r.sku}" also appears on row ${prevRow}` });
    else seenSku.set(r.sku.toLowerCase(), r.row);
  }
  const validRows = rows.filter((r) => !r.sku || seenSku.get(r.sku.toLowerCase()) === r.row);

  return { rows: validRows, errors: errors.sort((a, b) => a.row - b.row) };
}

router.post(
  "/import/validate",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_EDIT),
  xlsxUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No file was uploaded");
    const { rows, errors } = await parseWorkbook(req.file.buffer);

    const skus = rows.filter((r) => r.sku).map((r) => r.sku!);
    const existing = skus.length
      ? await prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } })
      : [];
    const existingSkus = new Set(existing.map((p) => p.sku));

    res.json({
      totalRows: rows.length + errors.length,
      validCount: rows.length,
      errorCount: errors.length,
      createCount: rows.filter((r) => !r.sku || !existingSkus.has(r.sku)).length,
      updateCount: rows.filter((r) => r.sku && existingSkus.has(r.sku)).length,
      errors: errors.slice(0, 100),
      preview: rows.slice(0, 20).map((r) => ({
        row: r.row,
        sku: r.sku,
        title: r.title,
        basePrice: r.basePrice,
        willUpdate: !!(r.sku && existingSkus.has(r.sku)),
      })),
    });
  })
);

router.post(
  "/import/confirm",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_EDIT),
  xlsxUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No file was uploaded");
    const { rows, errors } = await parseWorkbook(req.file.buffer);

    let created = 0;
    let updated = 0;
    const writeErrors: RowError[] = [];

    for (const r of rows) {
      try {
        const existing = r.sku ? await prisma.product.findFirst({ where: { sku: r.sku } }) : null;
        const data = {
          sku: r.sku,
          title: r.title,
          brandId: r.brandId,
          categoryId: r.categoryId,
          branchId: r.branchId,
          condition: r.condition,
          status: r.status,
          basePrice: r.basePrice,
          compareAtPrice: r.compareAtPrice,
          boxAvailable: r.boxAvailable,
          isFeatured: r.isFeatured,
          isNewArrival: r.isNewArrival,
          isTrending: r.isTrending,
          isBestSeller: r.isBestSeller,
          isPtaApproved: r.isPtaApproved,
          description: r.description,
        };

        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          const slug = await uniqueProductSlug(r.title);
          await prisma.product.create({ data: { ...data, slug, createdById: req.user!.id } });
          created++;
        }
      } catch (err: any) {
        writeErrors.push({ row: r.row, message: err?.message || "Could not save this row" });
      }
    }

    recordAudit(req, {
      action: "product.imported",
      entityType: "Product",
      entityId: "bulk",
      meta: { created, updated, failed: writeErrors.length, invalid: errors.length },
    });

    res.json({
      created,
      updated,
      failed: writeErrors.length,
      skipped: errors.length,
      errors: [...errors, ...writeErrors].sort((a, b) => a.row - b.row).slice(0, 100),
    });
  })
);

export default router;
