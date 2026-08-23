"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniqueProductSlug = uniqueProductSlug;
const shared_1 = require("../shared");
const prisma_1 = require("../lib/prisma");
/** Generates a unique product slug, appending -2, -3, ... on collision. */
async function uniqueProductSlug(title, excludeId) {
    const base = (0, shared_1.slugify)(title) || "product";
    let slug = base;
    let n = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const existing = await prisma_1.prisma.product.findUnique({ where: { slug } });
        if (!existing || existing.id === excludeId)
            return slug;
        slug = `${base}-${n++}`;
    }
}
