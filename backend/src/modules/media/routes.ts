import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { authenticate, requireAnyPermission } from "../../middleware/auth";
import { imageUpload } from "../../middleware/upload";
import { processGenericImage } from "../../utils/image";
import { PERMISSIONS } from "../../shared";

const router = Router();

const ALLOWED_FOLDERS = new Set(["banners", "brands", "categories", "branches", "staff", "settings"]);

// processGenericImage previously used a single 1600px-wide rendition for
// every folder — fine for a hero banner, wasteful for a 64x64 category icon
// or a 140px site logo. Size each folder to what it's actually displayed
// at (with headroom for retina), rather than shipping full-size images for
// tiny UI elements.
const FOLDER_MAX_WIDTH: Record<string, number> = {
  banners: 1920,
  branches: 1000,
  brands: 480,
  categories: 480,
  staff: 480,
  settings: 480,
};

const folderSchema = z.object({ folder: z.string() });

// Generic single-image upload for non-product media (banner art, brand logos,
// category thumbnails, branch photos, staff headshots, site logo).
router.post(
  "/image",
  authenticate,
  requireAnyPermission(
    PERMISSIONS.CONTENT_BANNERS,
    PERMISSIONS.CONTENT_HOMEPAGE,
    PERMISSIONS.CATALOG_MANAGE_BRANDS,
    PERMISSIONS.CATALOG_MANAGE_CATEGORIES,
    PERMISSIONS.BRANCHES_MANAGE,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.PRODUCTS_EDIT
  ),
  imageUpload.single("image"),
  asyncHandler(async (req, res) => {
    const { folder } = folderSchema.parse(req.query);
    if (!ALLOWED_FOLDERS.has(folder)) throw new ApiError(400, "Invalid upload folder");
    if (!req.file) throw new ApiError(400, "No image was uploaded");

    const result = await processGenericImage(req.file.buffer, folder, FOLDER_MAX_WIDTH[folder]);
    res.status(201).json(result);
  })
);

export default router;
