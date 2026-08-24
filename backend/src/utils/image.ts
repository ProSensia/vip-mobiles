import sharp, { type Metadata } from "sharp";
import convertHeic from "heic-convert";
import { nanoid } from "nanoid";
import { storage } from "../lib/storage";
import { ApiError } from "../middleware/errorHandler";

// The sharp/libvips build available here can only decode the AVIF flavor of
// the ISO-BMFF ("ftyp") container, not real HEIC/HEIF (the default format
// for iPhone camera photos) — that needs libheif, which isn't in sharp's
// prebuilt binaries. Detect it by its ftyp brand and pre-convert to JPEG
// with a portable (WASM, no native build step) decoder before handing the
// buffer to sharp, so phone-camera photos work without the uploader having
// to know to export as JPEG first.
const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]);

function isHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  return HEIC_BRANDS.has(buffer.toString("ascii", 8, 12).toLowerCase());
}

async function normalizeInput(buffer: Buffer): Promise<Buffer> {
  if (!isHeic(buffer)) return buffer;
  try {
    const jpeg = await convertHeic({ buffer, format: "JPEG", quality: 0.92 });
    return Buffer.from(jpeg);
  } catch {
    throw new ApiError(400, "Could not read this HEIC/HEIF photo — please export it as JPEG and try again");
  }
}

export interface ProcessedImageSet {
  id: string;
  url: string; // primary (large) webp
  webpUrl: string;
  mediumUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
}

const SIZES = {
  large: 1600, // main gallery / product page
  medium: 800, // catalog / listing cards
  thumb: 320, // thumbnails / variant swatch previews
} as const;

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
export async function processProductImage(
  buffer: Buffer,
  folder: string
): Promise<ProcessedImageSet> {
  buffer = await normalizeInput(buffer);
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ApiError(400, "Uploaded file is not a valid image");
  }

  if (!metadata.width || !metadata.height) {
    throw new ApiError(400, "Uploaded file is not a valid image");
  }
  if (!["jpeg", "png", "webp", "avif", "gif"].includes(metadata.format ?? "")) {
    throw new ApiError(400, "Unsupported image format");
  }

  const id = nanoid(12);
  // Auto-orient using EXIF, then force sRGB before resizing/encoding — some
  // phone and DSLR photos embed a wide-gamut or CMYK profile, and letting
  // that ride through to WebP output renders badly shifted, or in some
  // cases near-black, in browsers/decoders that don't fully honor the
  // embedded profile.
  const base = sharp(buffer).rotate().toColorspace("srgb");

  const largeWidth = Math.min(SIZES.large, metadata.width);
  const mediumWidth = Math.min(SIZES.medium, metadata.width);
  const thumbWidth = Math.min(SIZES.thumb, metadata.width);

  const [largeWebp, mediumWebp, thumbWebp] = await Promise.all([
    base.clone().resize({ width: largeWidth, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    base.clone().resize({ width: mediumWidth, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    base.clone().resize({ width: thumbWidth, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer(),
  ]);

  const [webpUrl, mediumUrl, thumbUrl] = await Promise.all([
    storage.save(`${folder}/${id}-large.webp`, largeWebp),
    storage.save(`${folder}/${id}-medium.webp`, mediumWebp),
    storage.save(`${folder}/${id}-thumb.webp`, thumbWebp),
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
export async function processGenericImage(
  buffer: Buffer,
  folder: string,
  maxWidth = 1600
): Promise<{ url: string; width: number; height: number }> {
  buffer = await normalizeInput(buffer);
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ApiError(400, "Uploaded file is not a valid image");
  }
  if (!metadata.width || !metadata.height) {
    throw new ApiError(400, "Uploaded file is not a valid image");
  }

  const width = Math.min(maxWidth, metadata.width);
  const webp = await sharp(buffer)
    .rotate()
    .toColorspace("srgb")
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const id = nanoid(12);
  const url = await storage.save(`${folder}/${id}.webp`, webp);

  return { url, width, height: Math.round((metadata.height / metadata.width) * width) };
}
