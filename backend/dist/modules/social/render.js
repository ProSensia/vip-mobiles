"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRAND = void 0;
exports.renderInstagramCreative = renderInstagramCreative;
exports.renderTikTokCreative = renderTikTokCreative;
exports.formatCreativePrice = formatCreativePrice;
const sharp_1 = __importDefault(require("sharp"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const shared_1 = require("@vip/shared");
Object.defineProperty(exports, "BRAND", { enumerable: true, get: function () { return shared_1.BRAND; } });
const env_1 = require("../../env");
const svgUtils_1 = require("./svgUtils");
const BRAND_LOGO_PATH = path_1.default.resolve(__dirname, "../../assets/brand-logo.jpg");
const DIMENSIONS = {
    INSTAGRAM_SQUARE: { width: 1080, height: 1080 },
    INSTAGRAM_PORTRAIT: { width: 1080, height: 1350 },
    TIKTOK: { width: 1080, height: 1920 },
};
function angleToCoords(angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const x = Math.cos(rad);
    const y = Math.sin(rad);
    const toPct = (v) => `${Math.round((v + 1) * 50)}%`;
    return { x1: toPct(-x), y1: toPct(-y), x2: toPct(x), y2: toPct(y) };
}
function pickGradient(id) {
    return shared_1.SOCIAL_GRADIENTS.find((g) => g.id === id) ?? shared_1.SOCIAL_GRADIENTS[0];
}
function resolveLocalPath(publicUrl) {
    const rel = publicUrl.replace(/^\/uploads\//, "");
    return path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR, rel);
}
async function readImageBuffer(publicUrl) {
    return fs_1.default.promises.readFile(resolveLocalPath(publicUrl));
}
async function roundedImage(buffer, width, height, radius) {
    const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
    const resized = await (0, sharp_1.default)(buffer).resize(width, height, { fit: "cover" }).toBuffer();
    return (0, sharp_1.default)(resized)
        .composite([{ input: mask, blend: "dest-in" }])
        .png()
        .toBuffer();
}
function backgroundSvg(width, height, gradientId) {
    const gradient = pickGradient(gradientId);
    const { x1, y1, x2, y2 } = angleToCoords(gradient.angle);
    return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        <stop offset="0%" stop-color="${gradient.from}"/>
        <stop offset="100%" stop-color="${gradient.to}"/>
      </linearGradient>
      <radialGradient id="glow" cx="80%" cy="10%" r="60%">
        <stop offset="0%" stop-color="${shared_1.BRAND_COLORS.gold[400]}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${shared_1.BRAND_COLORS.gold[400]}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" fill="url(#glow)"/>
    <rect x="18" y="18" width="${width - 36}" height="${height - 36}" fill="none"
          stroke="${shared_1.BRAND_COLORS.gold[500]}" stroke-opacity="0.35" stroke-width="2"/>
  </svg>`;
}
function textLayerSvg(opts) {
    const { width, showPrice, showDescription, showCTA } = opts;
    const align = opts.align ?? "left";
    const anchor = align === "center" ? "middle" : "start";
    const x = align === "center" ? width / 2 : 64;
    const maxChars = align === "center" ? 26 : 22;
    const titleLines = (0, svgUtils_1.wrapText)(opts.title, maxChars, 3);
    let y = opts.textBlockTop;
    const parts = [];
    for (const line of titleLines) {
        parts.push(`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="64" fill="${shared_1.BRAND_COLORS.cream}" text-anchor="${anchor}">${(0, svgUtils_1.escapeXml)(line)}</text>`);
        y += 72;
    }
    if (showPrice && opts.price) {
        y += 18;
        parts.push(`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="56" fill="${shared_1.BRAND_COLORS.gold[400]}" text-anchor="${anchor}">${(0, svgUtils_1.escapeXml)(opts.price)}</text>`);
        y += 56;
    }
    if (showDescription && opts.description) {
        y += 20;
        const descLines = (0, svgUtils_1.wrapText)(opts.description, maxChars + 10, 2);
        for (const line of descLines) {
            parts.push(`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="32" fill="${shared_1.BRAND_COLORS.muted}" text-anchor="${anchor}">${(0, svgUtils_1.escapeXml)(line)}</text>`);
            y += 40;
        }
    }
    if (showCTA && opts.ctaText) {
        y += 36;
        const ctaWidth = Math.min(width - 128, opts.ctaText.length * 22 + 80);
        const ctaX = align === "center" ? width / 2 - ctaWidth / 2 : x;
        parts.push(`
      <rect x="${ctaX}" y="${y - 44}" width="${ctaWidth}" height="72" rx="36" fill="${shared_1.BRAND_COLORS.gold[500]}"/>
      <text x="${ctaX + ctaWidth / 2}" y="${y + 4}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="30" fill="${shared_1.BRAND_COLORS.black[900]}" text-anchor="middle">${(0, svgUtils_1.escapeXml)(opts.ctaText)}</text>
    `);
    }
    return `<svg width="${opts.width}" height="${opts.height}" xmlns="http://www.w3.org/2000/svg">${parts.join("\n")}</svg>`;
}
async function loadLogo(maxWidth) {
    try {
        const buf = await fs_1.default.promises.readFile(BRAND_LOGO_PATH);
        return (0, sharp_1.default)(buf).resize({ width: maxWidth }).png().toBuffer();
    }
    catch {
        return null;
    }
}
async function renderInstagramCreative(product, mainImageUrl, supportingImageUrls, config) {
    const dims = config.format === "portrait" ? DIMENSIONS.INSTAGRAM_PORTRAIT : DIMENSIONS.INSTAGRAM_SQUARE;
    const { width, height } = dims;
    const base = await (0, sharp_1.default)(Buffer.from(backgroundSvg(width, height, config.gradientId))).png().toBuffer();
    const composites = [];
    const photoSize = Math.round(width * 0.62);
    const photoX = width - photoSize - 48;
    const photoY = Math.round(height * 0.16);
    const mainBuf = await readImageBuffer(mainImageUrl);
    const roundedMain = await roundedImage(mainBuf, photoSize, photoSize, 32);
    composites.push({ input: roundedMain, left: photoX, top: photoY });
    if (config.showSupportingImages !== false && supportingImageUrls.length > 0) {
        const thumbSize = 150;
        let ty = photoY + photoSize + 24;
        let tx = photoX + photoSize - thumbSize;
        for (const url of supportingImageUrls.slice(0, 3)) {
            try {
                const buf = await readImageBuffer(url);
                const rounded = await roundedImage(buf, thumbSize, thumbSize, 18);
                composites.push({ input: rounded, left: tx, top: ty });
                tx -= thumbSize + 16;
            }
            catch {
                // skip unreadable supporting image
            }
        }
    }
    if (config.showLogo !== false) {
        const logo = await loadLogo(140);
        if (logo)
            composites.push({ input: logo, left: 48, top: 48 });
    }
    const textSvg = textLayerSvg({
        width,
        height,
        title: product.title,
        price: config.showPrice !== false ? product.price : null,
        description: config.description ?? product.description ?? null,
        ctaText: config.showCTA !== false ? config.ctaText || "Available Now – DM to Order" : null,
        showPrice: config.showPrice !== false,
        showDescription: config.showDescription !== false,
        showCTA: config.showCTA !== false,
        textBlockTop: Math.round(height * 0.62),
        align: "left",
    });
    composites.push({ input: Buffer.from(textSvg), left: 0, top: 0 });
    return (0, sharp_1.default)(base).composite(composites).png({ quality: 92 }).toBuffer();
}
async function renderTikTokCreative(product, mainImageUrl, config) {
    const { width, height } = DIMENSIONS.TIKTOK;
    const base = await (0, sharp_1.default)(Buffer.from(backgroundSvg(width, height, config.gradientId))).png().toBuffer();
    const composites = [];
    const photoSize = Math.round(width * 0.86);
    const mainBuf = await readImageBuffer(mainImageUrl);
    const roundedMain = await roundedImage(mainBuf, photoSize, photoSize, 40);
    composites.push({ input: roundedMain, left: Math.round((width - photoSize) / 2), top: Math.round(height * 0.14) });
    // Bottom scrim so text stays legible over any photo.
    const scrimSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${shared_1.BRAND_COLORS.black[950]}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${shared_1.BRAND_COLORS.black[950]}" stop-opacity="0.92"/>
    </linearGradient></defs>
    <rect x="0" y="${height * 0.6}" width="${width}" height="${height * 0.4}" fill="url(#scrim)"/>
  </svg>`;
    composites.push({ input: Buffer.from(scrimSvg), left: 0, top: 0 });
    if (config.showLogo !== false) {
        const logo = await loadLogo(120);
        if (logo)
            composites.push({ input: logo, left: Math.round((width - 120) / 2), top: 56 });
    }
    const textSvg = textLayerSvg({
        width,
        height,
        title: product.title,
        price: config.showPrice !== false ? product.price : null,
        description: config.description ?? product.description ?? null,
        ctaText: config.showCTA !== false ? config.ctaText || "Tap the Link in Bio" : null,
        showPrice: config.showPrice !== false,
        showDescription: config.showDescription !== false,
        showCTA: config.showCTA !== false,
        textBlockTop: Math.round(height * 0.78),
        align: "center",
    });
    composites.push({ input: Buffer.from(textSvg), left: 0, top: 0 });
    return (0, sharp_1.default)(base).composite(composites).png({ quality: 92 }).toBuffer();
}
function formatCreativePrice(price, currency = "PKR") {
    return (0, shared_1.formatCurrency)(price, currency);
}
