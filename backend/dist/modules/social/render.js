"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRAND = void 0;
exports.renderInstagramCreative = renderInstagramCreative;
exports.renderStoryCreative = renderStoryCreative;
exports.renderBoldCreative = renderBoldCreative;
exports.formatCreativePrice = formatCreativePrice;
const sharp_1 = __importDefault(require("sharp"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const shared_1 = require("../../shared");
Object.defineProperty(exports, "BRAND", { enumerable: true, get: function () { return shared_1.BRAND; } });
const env_1 = require("../../env");
const svgUtils_1 = require("./svgUtils");
const BRAND_LOGO_PATH = path_1.default.resolve(__dirname, "../../assets/brand-logo.jpg");
const DIMENSIONS = {
    INSTAGRAM_SQUARE: { width: 1080, height: 1080 },
    INSTAGRAM_PORTRAIT: { width: 1080, height: 1350 },
    STORY: { width: 1080, height: 1920 },
};
const BADGE_COLORS = {
    discount: { bg: "#DC2626", text: "#FFFFFF" },
    new: { bg: "#2563EB", text: "#FFFFFF" },
    hot: { bg: "#EA580C", text: "#FFFFFF" },
    best: { bg: shared_1.BRAND_COLORS.gold[500], text: shared_1.BRAND_COLORS.black[950] },
    stock: { bg: "#D97706", text: "#FFFFFF" },
    trust: { bg: "rgba(8,8,10,0.85)", text: shared_1.BRAND_COLORS.cream },
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
/** A row of rounded badge pills. Estimates pill width from character count (no real font metrics available in SVG-land). */
function badgeStackSvg(badges, x, y, opts = {}) {
    if (badges.length === 0)
        return "";
    const fontSize = opts.fontSize ?? 26;
    const height = fontSize + 22;
    const gap = 12;
    const align = opts.align ?? "left";
    const widths = badges.map((b) => Math.round(b.text.length * fontSize * 0.62) + 44);
    const totalWidth = widths.reduce((s, w) => s + w, 0) + gap * (badges.length - 1);
    let cursorX = align === "center" ? x - totalWidth / 2 : x;
    const parts = [];
    badges.forEach((badge, i) => {
        const w = widths[i];
        const colors = BADGE_COLORS[badge.tone];
        parts.push(`
      <rect x="${cursorX}" y="${y}" width="${w}" height="${height}" rx="${height / 2}" fill="${colors.bg}"/>
      <text x="${cursorX + w / 2}" y="${y + height / 2 + fontSize * 0.35}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${fontSize}" fill="${colors.text}" text-anchor="middle" letter-spacing="0.5">${(0, svgUtils_1.escapeXml)(badge.text)}</text>
    `);
        cursorX += w + gap;
    });
    return parts.join("\n");
}
/** Small logo + wordmark lockup, tasteful rather than dominant. */
async function logoLockupComposite(x, y) {
    const logo = await loadLogo(84);
    if (!logo)
        return [];
    const meta = await (0, sharp_1.default)(logo).metadata();
    const logoW = meta.width ?? 84;
    const wordmarkSvg = `<svg width="420" height="84" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="38" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="30" fill="${shared_1.BRAND_COLORS.cream}" letter-spacing="0.5">${(0, svgUtils_1.escapeXml)(shared_1.BRAND.name.toUpperCase())}</text>
    <text x="0" y="64" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="16" fill="${shared_1.BRAND_COLORS.gold[400]}">${(0, svgUtils_1.escapeXml)(shared_1.BRAND.tagline)}</text>
  </svg>`;
    return [
        { input: logo, left: x, top: y },
        { input: Buffer.from(wordmarkSvg), left: x + logoW + 16, top: y },
    ];
}
/** Bottom contact strip — website + WhatsApp, present on every creative so a saved/forwarded image is always traceable back to the store. */
function contactFooterSvg(width, height, websiteUrl, whatsappNumber) {
    const parts = [websiteUrl, whatsappNumber ? `WhatsApp: ${whatsappNumber}` : null].filter(Boolean);
    if (parts.length === 0)
        return "";
    const barHeight = 68;
    const y = height - barHeight;
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${y}" width="${width}" height="${barHeight}" fill="${shared_1.BRAND_COLORS.black[950]}" fill-opacity="0.55"/>
    <text x="${width / 2}" y="${y + barHeight / 2 + 7}" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="24" fill="${shared_1.BRAND_COLORS.cream}" text-anchor="middle" letter-spacing="0.5">${(0, svgUtils_1.escapeXml)(parts.join("   ·   "))}</text>
  </svg>`;
}
// Empirical average glyph width as a fraction of font size for Arial —
// there's no real text-measurement API available when building an SVG
// string by hand, so line-wrapping is derived from this rather than a
// fixed character count, which stops working the moment the available
// column width changes (that mismatch is what let titles overlap the
// product photo in earlier iterations of this layout).
const AVG_GLYPH_WIDTH_RATIO = 0.56;
function estimateMaxChars(availableWidth, fontSize) {
    return Math.max(6, Math.floor(availableWidth / (fontSize * AVG_GLYPH_WIDTH_RATIO)));
}
function textLayerSvg(opts) {
    const { width, showPrice, showDescription, showCTA } = opts;
    const align = opts.align ?? "left";
    const anchor = align === "center" ? "middle" : "start";
    const x = align === "center" ? width / 2 : 64;
    const availableWidth = width - 128;
    const titleFontSize = 52;
    const titleLines = (0, svgUtils_1.wrapText)(opts.title, estimateMaxChars(availableWidth, titleFontSize), 2);
    let y = opts.textBlockTop;
    const parts = [];
    for (const line of titleLines) {
        parts.push(`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${titleFontSize}" fill="${shared_1.BRAND_COLORS.cream}" text-anchor="${anchor}">${(0, svgUtils_1.escapeXml)(line)}</text>`);
        y += titleFontSize + 10;
    }
    if (showPrice && opts.price) {
        y += 16;
        const priceFontSize = 54;
        parts.push(`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${priceFontSize}" fill="${shared_1.BRAND_COLORS.gold[400]}" text-anchor="${anchor}">${(0, svgUtils_1.escapeXml)(opts.price)}</text>`);
        if (opts.compareAtPrice) {
            // font-weight 900 renders noticeably wider per glyph than the general
            // estimate below is calibrated for — verified against an actual
            // rendered test image, not guessed.
            const priceWidth = opts.price.length * priceFontSize * 0.66;
            const strikeX = align === "center" ? x + priceWidth / 2 + 28 : x + priceWidth + 28;
            parts.push(`<text x="${strikeX}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="30" fill="${shared_1.BRAND_COLORS.muted}" text-anchor="start" text-decoration="line-through">${(0, svgUtils_1.escapeXml)(opts.compareAtPrice)}</text>`);
        }
        y += 38;
    }
    if (opts.stockLine) {
        y += 6;
        parts.push(`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="26" fill="${shared_1.BRAND_COLORS.gold[200]}" text-anchor="${anchor}">${(0, svgUtils_1.escapeXml)(opts.stockLine)}</text>`);
        y += 12;
    }
    // Reserve room for the CTA before deciding whether — and how much of —
    // the description still fits in the remaining budget.
    const ctaReserve = showCTA && opts.ctaText ? 112 : 0;
    const usedSoFar = y - opts.textBlockTop;
    const remaining = (opts.availableHeight ?? Infinity) - usedSoFar - ctaReserve;
    if (showDescription && opts.description && remaining > 60) {
        y += 20;
        const descFontSize = 28;
        const maxDescLines = remaining > 100 ? 2 : 1;
        const descLines = (0, svgUtils_1.wrapText)(opts.description, estimateMaxChars(availableWidth, descFontSize), maxDescLines);
        for (const line of descLines) {
            parts.push(`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="${descFontSize}" fill="${shared_1.BRAND_COLORS.muted}" text-anchor="${anchor}">${(0, svgUtils_1.escapeXml)(line)}</text>`);
            y += 36;
        }
    }
    if (showCTA && opts.ctaText) {
        y += 34;
        const ctaWidth = Math.min(availableWidth, opts.ctaText.length * 20 + 76);
        const ctaX = align === "center" ? width / 2 - ctaWidth / 2 : x;
        parts.push(`
      <rect x="${ctaX}" y="${y - 42}" width="${ctaWidth}" height="68" rx="34" fill="${shared_1.BRAND_COLORS.gold[500]}"/>
      <text x="${ctaX + ctaWidth / 2}" y="${y + 3}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="28" fill="${shared_1.BRAND_COLORS.black[900]}" text-anchor="middle">${(0, svgUtils_1.escapeXml)(opts.ctaText)}</text>
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
    const badges = config.showBadges !== false ? (product.badges ?? []).slice(0, 3) : [];
    const base = await (0, sharp_1.default)(Buffer.from(backgroundSvg(width, height, config.gradientId))).png().toBuffer();
    const composites = [];
    // Photo + badges occupy a top-right block; the text block starts below it
    // and spans the full width — stacking top-to-bottom (rather than a
    // photo-right/text-left column split) avoids the text column ever having
    // to fight the photo for horizontal space, which is what caused titles to
    // visually overlap the product photo in earlier iterations of this layout.
    const photoSize = Math.round(width * 0.46);
    const photoX = width - photoSize - 44;
    const photoY = 96;
    const mainBuf = await readImageBuffer(mainImageUrl);
    const roundedMain = await roundedImage(mainBuf, photoSize, photoSize, 28);
    composites.push({ input: roundedMain, left: photoX, top: photoY });
    if (config.showSupportingImages !== false && supportingImageUrls.length > 0) {
        const thumbSize = 96;
        let tx = photoX;
        const ty = photoY + photoSize + 16;
        for (const url of supportingImageUrls.slice(0, 3)) {
            try {
                const buf = await readImageBuffer(url);
                const rounded = await roundedImage(buf, thumbSize, thumbSize, 14);
                composites.push({ input: rounded, left: tx, top: ty });
                tx += thumbSize + 12;
            }
            catch {
                // skip unreadable supporting image
            }
        }
    }
    if (config.showLogo !== false) {
        composites.push(...(await logoLockupComposite(48, 48)));
    }
    if (badges.length > 0) {
        const badgeSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${badgeStackSvg(badges, photoX + 14, photoY + 14, { fontSize: 22 })}</svg>`;
        composites.push({ input: Buffer.from(badgeSvg), left: 0, top: 0 });
    }
    const textTop = photoY + photoSize + 64;
    const textSvg = textLayerSvg({
        width,
        height,
        title: product.title,
        price: config.showPrice !== false ? product.price : null,
        compareAtPrice: config.showPrice !== false ? product.compareAtPrice : null,
        stockLine: product.stockLine,
        description: config.description ?? product.description ?? null,
        ctaText: config.showCTA !== false ? config.ctaText || "Available Now – DM to Order" : null,
        showPrice: config.showPrice !== false,
        showDescription: config.showDescription !== false,
        showCTA: config.showCTA !== false,
        textBlockTop: textTop,
        availableHeight: height - textTop - 100,
        align: "left",
    });
    composites.push({ input: Buffer.from(textSvg), left: 0, top: 0 });
    if (product.websiteUrl || product.whatsappNumber) {
        composites.push({ input: Buffer.from(contactFooterSvg(width, height, product.websiteUrl, product.whatsappNumber)), left: 0, top: 0 });
    }
    return (0, sharp_1.default)(base).composite(composites).png({ quality: 92 }).toBuffer();
}
/** 9:16 format — used for TikTok, Instagram/Facebook Story and WhatsApp Status alike (same dimensions, same composition). */
async function renderStoryCreative(product, mainImageUrl, config) {
    const { width, height } = DIMENSIONS.STORY;
    const badges = config.showBadges !== false ? (product.badges ?? []).slice(0, 3) : [];
    const base = await (0, sharp_1.default)(Buffer.from(backgroundSvg(width, height, config.gradientId))).png().toBuffer();
    const composites = [];
    const photoSize = Math.round(width * 0.84);
    const photoX = Math.round((width - photoSize) / 2);
    const photoY = Math.round(height * 0.14);
    const mainBuf = await readImageBuffer(mainImageUrl);
    const roundedMain = await roundedImage(mainBuf, photoSize, photoSize, 40);
    composites.push({ input: roundedMain, left: photoX, top: photoY });
    // Bottom scrim so text stays legible over any photo.
    const scrimSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${shared_1.BRAND_COLORS.black[950]}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${shared_1.BRAND_COLORS.black[950]}" stop-opacity="0.92"/>
    </linearGradient></defs>
    <rect x="0" y="${height * 0.56}" width="${width}" height="${height * 0.44}" fill="url(#scrim)"/>
  </svg>`;
    composites.push({ input: Buffer.from(scrimSvg), left: 0, top: 0 });
    if (config.showLogo !== false) {
        const logo = await loadLogo(96);
        if (logo)
            composites.push({ input: logo, left: Math.round((width - 96) / 2), top: 48 });
    }
    if (badges.length > 0) {
        const badgeSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${badgeStackSvg(badges, photoX + 24, photoY + 24)}</svg>`;
        composites.push({ input: Buffer.from(badgeSvg), left: 0, top: 0 });
    }
    const textSvg = textLayerSvg({
        width,
        height,
        title: product.title,
        price: config.showPrice !== false ? product.price : null,
        compareAtPrice: config.showPrice !== false ? product.compareAtPrice : null,
        stockLine: product.stockLine,
        description: config.description ?? product.description ?? null,
        ctaText: config.showCTA !== false ? config.ctaText || "Tap the Link in Bio" : null,
        showPrice: config.showPrice !== false,
        showDescription: config.showDescription !== false,
        showCTA: config.showCTA !== false,
        textBlockTop: Math.round(height * 0.72),
        availableHeight: height - Math.round(height * 0.72) - 100,
        align: "center",
    });
    composites.push({ input: Buffer.from(textSvg), left: 0, top: 0 });
    if (product.websiteUrl || product.whatsappNumber) {
        composites.push({ input: Buffer.from(contactFooterSvg(width, height, product.websiteUrl, product.whatsappNumber)), left: 0, top: 0 });
    }
    return (0, sharp_1.default)(base).composite(composites).png({ quality: 92 }).toBuffer();
}
/**
 * "Bold" template — centered composition with a larger photo and
 * price-forward emphasis, vs. Classic's left-text/right-photo layout. Square
 * format only. An earlier version force-cropped the photo into a wide
 * letterbox for a full-bleed look, but that badly distorts a vertical phone
 * product shot (cuts off top/bottom) — verified by rendering it, not assumed
 * — so this keeps the photo uncropped like Classic/Story, just centered and
 * larger.
 */
async function renderBoldCreative(product, mainImageUrl, config) {
    const { width, height } = DIMENSIONS.INSTAGRAM_SQUARE;
    const badges = config.showBadges !== false ? (product.badges ?? []).slice(0, 3) : [];
    const base = await (0, sharp_1.default)(Buffer.from(backgroundSvg(width, height, config.gradientId))).png().toBuffer();
    const composites = [];
    const photoSize = Math.round(width * 0.56);
    const photoX = Math.round((width - photoSize) / 2);
    const photoY = 64;
    const mainBuf = await readImageBuffer(mainImageUrl);
    const roundedMain = await roundedImage(mainBuf, photoSize, photoSize, 36);
    composites.push({ input: roundedMain, left: photoX, top: photoY });
    if (config.showLogo !== false) {
        const logo = await loadLogo(72);
        if (logo)
            composites.push({ input: logo, left: Math.round((width - 72) / 2), top: 16 });
    }
    if (badges.length > 0) {
        const badgeSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${badgeStackSvg(badges, width / 2, photoY + photoSize + 28, { align: "center", fontSize: 24 })}</svg>`;
        composites.push({ input: Buffer.from(badgeSvg), left: 0, top: 0 });
    }
    const textTop = photoY + photoSize + (badges.length > 0 ? 118 : 84);
    const textSvg = textLayerSvg({
        width,
        height,
        title: product.title,
        price: config.showPrice !== false ? product.price : null,
        compareAtPrice: config.showPrice !== false ? product.compareAtPrice : null,
        stockLine: product.stockLine,
        description: config.description ?? product.description ?? null,
        ctaText: config.showCTA !== false ? config.ctaText || "Available Now – DM to Order" : null,
        showPrice: config.showPrice !== false,
        showDescription: config.showDescription !== false,
        showCTA: config.showCTA !== false,
        textBlockTop: textTop,
        availableHeight: height - textTop - 100,
        align: "center",
    });
    composites.push({ input: Buffer.from(textSvg), left: 0, top: 0 });
    if (product.websiteUrl || product.whatsappNumber) {
        composites.push({ input: Buffer.from(contactFooterSvg(width, height, product.websiteUrl, product.whatsappNumber)), left: 0, top: 0 });
    }
    return (0, sharp_1.default)(base).composite(composites).png({ quality: 92 }).toBuffer();
}
function formatCreativePrice(price, currency = "PKR") {
    return (0, shared_1.formatCurrency)(price, currency);
}
