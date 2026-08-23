import { slugify } from "../shared";
import { prisma } from "../lib/prisma";

/** Generates a unique product slug, appending -2, -3, ... on collision. */
export async function uniqueProductSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || "product";
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${n++}`;
  }
}
