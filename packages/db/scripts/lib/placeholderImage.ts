// Generates a clean, on-brand placeholder "product photo" (device silhouette
// on a gradient card) for demo seed data, so the catalog/product pages have
// real, working WebP/AVIF images to lazy-load and render without needing
// external network access or licensed stock photography.
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { BRAND_COLORS } from "@vip/shared";

const API_UPLOAD_ROOT = path.resolve(__dirname, "../../../../backend/uploads");

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function deviceCardSvg(size: number, label: string, accentHex: string): string {
  const deviceW = size * 0.42;
  const deviceH = size * 0.78;
  const dx = (size - deviceW) / 2;
  const dy = (size - deviceH) / 2;

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_COLORS.black[800]}"/>
        <stop offset="100%" stop-color="${BRAND_COLORS.black[950]}"/>
      </linearGradient>
      <linearGradient id="device" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accentHex}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${BRAND_COLORS.black[700]}"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <circle cx="${size * 0.82}" cy="${size * 0.16}" r="${size * 0.22}" fill="${BRAND_COLORS.gold[500]}" opacity="0.08"/>
    <rect x="${dx}" y="${dy}" width="${deviceW}" height="${deviceH}" rx="${deviceW * 0.14}"
          fill="url(#device)" stroke="${BRAND_COLORS.gold[500]}" stroke-opacity="0.4" stroke-width="2"/>
    <rect x="${dx + deviceW * 0.08}" y="${dy + deviceH * 0.05}" width="${deviceW * 0.84}" height="${deviceH * 0.78}"
          rx="${deviceW * 0.06}" fill="${BRAND_COLORS.black[900]}" opacity="0.55"/>
    <circle cx="${size / 2}" cy="${dy + deviceH * 0.9}" r="${deviceW * 0.06}" fill="${BRAND_COLORS.gold[500]}" opacity="0.6"/>
    <text x="${size / 2}" y="${size * 0.94}" font-family="Arial, Helvetica, sans-serif" font-weight="700"
          font-size="${size * 0.032}" fill="${BRAND_COLORS.muted}" text-anchor="middle" opacity="0.8">${escapeXml(label)}</text>
  </svg>`;
}

export async function createPlaceholderProductImages(title: string, accentHex: string = BRAND_COLORS.gold[500]) {
  const id = nanoid(12);
  const folder = path.join(API_UPLOAD_ROOT, "products", "demo");
  await fs.promises.mkdir(folder, { recursive: true });

  const sizes: Array<[string, number]> = [
    ["large", 1200],
    ["medium", 700],
    ["thumb", 320],
  ];

  let webpUrl = "";
  let avifUrl = "";
  let thumbUrl = "";

  for (const [tag, size] of sizes) {
    const svg = deviceCardSvg(size, title, accentHex);
    const png = sharp(Buffer.from(svg));

    const webpBuf = await png.clone().webp({ quality: 82 }).toBuffer();
    const webpPath = path.join(folder, `${id}-${tag}.webp`);
    await fs.promises.writeFile(webpPath, webpBuf);
    const url = `/uploads/products/demo/${id}-${tag}.webp`;
    if (tag === "large") webpUrl = url;
    if (tag === "thumb") thumbUrl = url;

    if (tag === "large") {
      const avifBuf = await png.clone().avif({ quality: 60 }).toBuffer();
      const avifPath = path.join(folder, `${id}-large.avif`);
      await fs.promises.writeFile(avifPath, avifBuf);
      avifUrl = `/uploads/products/demo/${id}-large.avif`;
    }
  }

  return { url: webpUrl, webpUrl, avifUrl, thumbUrl, width: 1200, height: 1200 };
}
