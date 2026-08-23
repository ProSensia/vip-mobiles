import type { MetadataRoute } from "next";
import { publicApiSafe } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productsData, branchesData, categoriesData] = await Promise.all([
    publicApiSafe<{ items: any[] }>("/api/products?limit=60&sort=newest"),
    publicApiSafe<{ branches: any[] }>("/api/branches"),
    publicApiSafe<{ categories: any[] }>("/api/categories"),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/branches`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const productRoutes: MetadataRoute.Sitemap = (productsData?.items ?? []).map((p) => ({
    url: `${SITE_URL}/product/${p.slug}`,
    lastModified: p.createdAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const branchRoutes: MetadataRoute.Sitemap = (branchesData?.branches ?? []).map((b) => ({
    url: `${SITE_URL}/branches/${b.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = (categoriesData?.categories ?? []).map((c) => ({
    url: `${SITE_URL}/catalog?category=${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...branchRoutes, ...categoryRoutes];
}
