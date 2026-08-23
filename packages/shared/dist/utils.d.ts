export declare function slugify(input: string): string;
export declare function formatCurrency(amount: number | string, currency?: string): string;
/** Extracts a normalized video id/embed info from a YouTube, TikTok or Instagram URL. */
export declare function parseSocialVideoUrl(url: string): {
    platform: "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | null;
    embedId: string | null;
};
