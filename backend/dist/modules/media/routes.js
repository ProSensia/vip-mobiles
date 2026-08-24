"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const errorHandler_1 = require("../../middleware/errorHandler");
const auth_1 = require("../../middleware/auth");
const upload_1 = require("../../middleware/upload");
const image_1 = require("../../utils/image");
const shared_1 = require("../../shared");
const router = (0, express_1.Router)();
const ALLOWED_FOLDERS = new Set(["banners", "brands", "categories", "branches", "staff", "settings"]);
// processGenericImage previously used a single 1600px-wide rendition for
// every folder — fine for a hero banner, wasteful for a 64x64 category icon
// or a 140px site logo. Size each folder to what it's actually displayed
// at (with headroom for retina), rather than shipping full-size images for
// tiny UI elements.
const FOLDER_MAX_WIDTH = {
    banners: 1920,
    branches: 1000,
    brands: 480,
    categories: 480,
    staff: 480,
    settings: 480,
};
const folderSchema = zod_1.z.object({ folder: zod_1.z.string() });
// Generic single-image upload for non-product media (banner art, brand logos,
// category thumbnails, branch photos, staff headshots, site logo).
router.post("/image", auth_1.authenticate, (0, auth_1.requireAnyPermission)(shared_1.PERMISSIONS.CONTENT_BANNERS, shared_1.PERMISSIONS.CONTENT_HOMEPAGE, shared_1.PERMISSIONS.CATALOG_MANAGE_BRANDS, shared_1.PERMISSIONS.CATALOG_MANAGE_CATEGORIES, shared_1.PERMISSIONS.BRANCHES_MANAGE, shared_1.PERMISSIONS.STAFF_MANAGE, shared_1.PERMISSIONS.SETTINGS_MANAGE, shared_1.PERMISSIONS.PRODUCTS_EDIT), upload_1.imageUpload.single("image"), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { folder } = folderSchema.parse(req.query);
    if (!ALLOWED_FOLDERS.has(folder))
        throw new errorHandler_1.ApiError(400, "Invalid upload folder");
    if (!req.file)
        throw new errorHandler_1.ApiError(400, "No image was uploaded");
    const result = await (0, image_1.processGenericImage)(req.file.buffer, folder, FOLDER_MAX_WIDTH[folder]);
    res.status(201).json(result);
}));
exports.default = router;
