"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processProductImage = processProductImage;
exports.processGenericImage = processGenericImage;
const sharp_1 = __importDefault(require("sharp"));
const nanoid_1 = require("nanoid");
const storage_1 = require("../lib/storage");
const errorHandler_1 = require("../middleware/errorHandler");
const SIZES = {
    large: 1600, // main gallery / product page
    medium: 800, // catalog cards
    thumb: 320, // thumbnails / variant swatch previews
};
const WEBP_QUALITY = 82;
const AVIF_QUALITY = 60; // AVIF achieves similar visual quality at a lower quality setting
/**
 * Validates the buffer is a real, decodable image (protects against spoofed
 * mime types / malicious payloads) and produces WebP + AVIF renditions at
 * several responsive widths, all under one content-addressed folder.
 */
async function processProductImage(buffer, folder) {
    let metadata;
    try {
        metadata = await (0, sharp_1.default)(buffer).metadata();
    }
    catch {
        throw new errorHandler_1.ApiError(400, "Uploaded file is not a valid image");
    }
    if (!metadata.width || !metadata.height) {
        throw new errorHandler_1.ApiError(400, "Uploaded file is not a valid image");
    }
    if (!["jpeg", "png", "webp", "avif", "gif"].includes(metadata.format ?? "")) {
        throw new errorHandler_1.ApiError(400, "Unsupported image format");
    }
    const id = (0, nanoid_1.nanoid)(12);
    const base = (0, sharp_1.default)(buffer).rotate(); // auto-orient using EXIF, then strip metadata on output
    const largeWidth = Math.min(SIZES.large, metadata.width);
    const [largeWebp, largeAvif, mediumWebp, thumbWebp] = await Promise.all([
        base
            .clone()
            .resize({ width: largeWidth, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer(),
        base
            .clone()
            .resize({ width: largeWidth, withoutEnlargement: true })
            .avif({ quality: AVIF_QUALITY })
            .toBuffer(),
        base
            .clone()
            .resize({ width: Math.min(SIZES.medium, metadata.width), withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer(),
        base
            .clone()
            .resize({ width: Math.min(SIZES.thumb, metadata.width), withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer(),
    ]);
    const [webpUrl, avifUrl] = await Promise.all([
        storage_1.storage.save(`${folder}/${id}-large.webp`, largeWebp),
        storage_1.storage.save(`${folder}/${id}-large.avif`, largeAvif),
    ]);
    await storage_1.storage.save(`${folder}/${id}-medium.webp`, mediumWebp);
    const thumbUrl = await storage_1.storage.save(`${folder}/${id}-thumb.webp`, thumbWebp);
    return {
        id,
        url: webpUrl,
        webpUrl,
        avifUrl,
        thumbUrl,
        width: largeWidth,
        height: Math.round((metadata.height / metadata.width) * largeWidth),
    };
}
/** Generic single-rendition processor for non-product images (banners, logos, staff photos, branch images). */
async function processGenericImage(buffer, folder, maxWidth = 1600) {
    let metadata;
    try {
        metadata = await (0, sharp_1.default)(buffer).metadata();
    }
    catch {
        throw new errorHandler_1.ApiError(400, "Uploaded file is not a valid image");
    }
    if (!metadata.width || !metadata.height) {
        throw new errorHandler_1.ApiError(400, "Uploaded file is not a valid image");
    }
    const width = Math.min(maxWidth, metadata.width);
    const webp = await (0, sharp_1.default)(buffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    const id = (0, nanoid_1.nanoid)(12);
    const url = await storage_1.storage.save(`${folder}/${id}.webp`, webp);
    return { url, width, height: Math.round((metadata.height / metadata.width) * width) };
}
