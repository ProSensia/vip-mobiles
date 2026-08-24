"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processProductImage = processProductImage;
exports.processGenericImage = processGenericImage;
const sharp_1 = __importDefault(require("sharp"));
const heic_convert_1 = __importDefault(require("heic-convert"));
const nanoid_1 = require("nanoid");
const storage_1 = require("../lib/storage");
const errorHandler_1 = require("../middleware/errorHandler");
// The sharp/libvips build available here can only decode the AVIF flavor of
// the ISO-BMFF ("ftyp") container, not real HEIC/HEIF (the default format
// for iPhone camera photos) — that needs libheif, which isn't in sharp's
// prebuilt binaries. Detect it by its ftyp brand and pre-convert to JPEG
// with a portable (WASM, no native build step) decoder before handing the
// buffer to sharp, so phone-camera photos work without the uploader having
// to know to export as JPEG first.
const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]);
function isHeic(buffer) {
    if (buffer.length < 12)
        return false;
    if (buffer.toString("ascii", 4, 8) !== "ftyp")
        return false;
    return HEIC_BRANDS.has(buffer.toString("ascii", 8, 12).toLowerCase());
}
async function normalizeInput(buffer) {
    if (!isHeic(buffer))
        return buffer;
    try {
        const jpeg = await (0, heic_convert_1.default)({ buffer, format: "JPEG", quality: 0.92 });
        return Buffer.from(jpeg);
    }
    catch {
        throw new errorHandler_1.ApiError(400, "Could not read this HEIC/HEIF photo — please export it as JPEG and try again");
    }
}
const SIZES = {
    large: 1600, // main gallery / product page
    medium: 800, // catalog / listing cards
    thumb: 320, // thumbnails / variant swatch previews
};
const WEBP_QUALITY = 82;
/**
 * Validates the buffer is a real, decodable image (protects against spoofed
 * mime types / malicious payloads) and produces WebP renditions at several
 * responsive widths, all under one content-addressed folder.
 *
 * Previously this also encoded an AVIF rendition, but nothing in the
 * frontend ever reads avifUrl — it was pure wasted CPU on the single most
 * expensive encode step (AV1 encoding is far slower than WebP), which is
 * why bulk image uploads could take minutes. Dropped until something
 * actually consumes it.
 */
async function processProductImage(buffer, folder) {
    buffer = await normalizeInput(buffer);
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
    // Auto-orient using EXIF, then force sRGB before resizing/encoding — some
    // phone and DSLR photos embed a wide-gamut or CMYK profile, and letting
    // that ride through to WebP output renders badly shifted, or in some
    // cases near-black, in browsers/decoders that don't fully honor the
    // embedded profile.
    const base = (0, sharp_1.default)(buffer).rotate().toColorspace("srgb");
    const largeWidth = Math.min(SIZES.large, metadata.width);
    const mediumWidth = Math.min(SIZES.medium, metadata.width);
    const thumbWidth = Math.min(SIZES.thumb, metadata.width);
    const [largeWebp, mediumWebp, thumbWebp] = await Promise.all([
        base.clone().resize({ width: largeWidth, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer(),
        base.clone().resize({ width: mediumWidth, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer(),
        base.clone().resize({ width: thumbWidth, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    ]);
    const [webpUrl, mediumUrl, thumbUrl] = await Promise.all([
        storage_1.storage.save(`${folder}/${id}-large.webp`, largeWebp),
        storage_1.storage.save(`${folder}/${id}-medium.webp`, mediumWebp),
        storage_1.storage.save(`${folder}/${id}-thumb.webp`, thumbWebp),
    ]);
    return {
        id,
        url: webpUrl,
        webpUrl,
        mediumUrl,
        thumbUrl,
        width: largeWidth,
        height: Math.round((metadata.height / metadata.width) * largeWidth),
    };
}
/** Generic single-rendition processor for non-product images (banners, logos, staff photos, branch images). */
async function processGenericImage(buffer, folder, maxWidth = 1600) {
    buffer = await normalizeInput(buffer);
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
        .toColorspace("srgb")
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    const id = (0, nanoid_1.nanoid)(12);
    const url = await storage_1.storage.save(`${folder}/${id}.webp`, webp);
    return { url, width, height: Math.round((metadata.height / metadata.width) * width) };
}
