import sharp from "sharp";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { BRAND_COLORS } from "@vip/shared";

const API_UPLOAD_ROOT = path.resolve(__dirname, "../../../../apps/api/uploads");

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function createPlaceholderBanner(title: string, subtitle: string): Promise<string> {
  const width = 1600;
  const height = 600;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_COLORS.black[900]}"/>
        <stop offset="100%" stop-color="${BRAND_COLORS.gold[800]}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="${width * 0.85}" cy="${height * 0.3}" r="220" fill="${BRAND_COLORS.gold[500]}" opacity="0.12"/>
    <text x="80" y="${height * 0.45}" font-family="Arial, Helvetica, sans-serif" font-weight="800"
          font-size="72" fill="${BRAND_COLORS.cream}">${escapeXml(title)}</text>
    <text x="80" y="${height * 0.6}" font-family="Arial, Helvetica, sans-serif" font-weight="400"
          font-size="32" fill="${BRAND_COLORS.gold[400]}">${escapeXml(subtitle)}</text>
  </svg>`;

  const folder = path.join(API_UPLOAD_ROOT, "banners", "demo");
  await fs.promises.mkdir(folder, { recursive: true });
  const id = nanoid(10);
  const buf = await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
  await fs.promises.writeFile(path.join(folder, `${id}.webp`), buf);
  return `/uploads/banners/demo/${id}.webp`;
}
