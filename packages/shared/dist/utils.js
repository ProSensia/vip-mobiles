"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = slugify;
exports.formatCurrency = formatCurrency;
exports.parseSocialVideoUrl = parseSocialVideoUrl;
function slugify(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 180);
}
function formatCurrency(amount, currency = "PKR") {
    const value = typeof amount === "string" ? Number(amount) : amount;
    if (Number.isNaN(value))
        return `${currency} 0`;
    return `${currency} ${new Intl.NumberFormat("en-US").format(value)}`;
}
/** Extracts a normalized video id/embed info from a YouTube, TikTok or Instagram URL. */
function parseSocialVideoUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, "");
        if (host === "youtube.com" || host === "m.youtube.com") {
            const id = u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? null;
            return { platform: "YOUTUBE", embedId: id };
        }
        if (host === "youtu.be") {
            return { platform: "YOUTUBE", embedId: u.pathname.replace("/", "") || null };
        }
        if (host === "tiktok.com") {
            const match = u.pathname.match(/\/video\/(\d+)/);
            return { platform: "TIKTOK", embedId: match ? match[1] : null };
        }
        if (host === "instagram.com") {
            const match = u.pathname.match(/\/(reel|p)\/([^/]+)/);
            return { platform: "INSTAGRAM", embedId: match ? match[2] : null };
        }
        return { platform: null, embedId: null };
    }
    catch {
        return { platform: null, embedId: null };
    }
}
