import "server-only";
import { cache } from "react";
import { publicApiSafe } from "./api";

// Header and Footer both need site settings on every single storefront page
// load — without memoizing this, that's two separate /api/settings round
// trips per page view instead of one. React's cache() collapses repeat
// calls within the same render into a single underlying fetch.
export const getSiteSettings = cache(async () => {
  const data = await publicApiSafe<{ settings: any }>("/api/settings");
  return data?.settings ?? null;
});
