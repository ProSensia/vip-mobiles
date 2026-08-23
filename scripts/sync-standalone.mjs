// Keeps backend/ and frontend/ installable standalone (plain `npm install`
// in each folder alone, no npm workspaces) in sync with the shared source of
// truth in packages/. Run this after editing packages/shared/src/*.ts or
// packages/db/prisma/schema.prisma:
//
//   node scripts/sync-standalone.mjs
//
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// --- 1. Merge packages/shared/src/*.ts into one self-contained file per app ---
const sharedSrcDir = path.join(root, "packages/shared/src");
const sharedFiles = ["permissions.ts", "brand.ts", "whatsapp.ts", "utils.ts"];

const sharedHeader = `// Self-contained copy of packages/shared/src/*.ts — duplicated here (not an
// npm/workspace dependency) so this app installs standalone via a plain
// \`npm install\` in this folder alone, with no monorepo/workspace context
// required. Namecheap's cPanel Node.js Selector runs npm install scoped to
// exactly one folder, which doesn't understand npm workspaces' "*" protocol.
//
// If you change packages/shared/src/*.ts, re-run \`node scripts/sync-standalone.mjs\`
// from the repo root to update this copy.
`;

const sharedBody = sharedFiles
  .map((f) => {
    const content = fs.readFileSync(path.join(sharedSrcDir, f), "utf8");
    return `// ---- from packages/shared/src/${f} ----\n${content.trim()}\n`;
  })
  .join("\n");

const sharedOut = sharedHeader + "\n" + sharedBody;
fs.writeFileSync(path.join(root, "backend/src/shared.ts"), sharedOut, "utf8");
fs.writeFileSync(path.join(root, "frontend/src/shared.ts"), sharedOut, "utf8");
console.log("Synced backend/src/shared.ts and frontend/src/shared.ts");

// --- 2. Copy the Prisma schema into backend/, generating into the standard
//        node_modules/@prisma/client location instead of packages/db's custom
//        ../generated/client path (which only makes sense inside the monorepo). ---
const schemaSrc = path.join(root, "packages/db/prisma/schema.prisma");
let schema = fs.readFileSync(schemaSrc, "utf8");
schema = schema.replace(/\n\s*output\s*=\s*"\.\.\/generated\/client"\n/, "\n");
schema =
  `// Synced from packages/db/prisma/schema.prisma by scripts/sync-standalone.mjs —\n` +
  `// edit the source there, not here, then re-run that script.\n` +
  schema;
fs.writeFileSync(path.join(root, "backend/prisma/schema.prisma"), schema, "utf8");
console.log("Synced backend/prisma/schema.prisma");
