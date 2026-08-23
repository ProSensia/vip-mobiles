// Next's `output: "standalone"` traces only the JS + node_modules it needs
// into .next/standalone — it deliberately does NOT copy `public/` or
// `.next/static/` (that's documented upstream behavior, not an oversight),
// so the standalone folder isn't actually servable until this runs. This
// makes `frontend/.next/standalone/frontend/` a genuinely complete, directly
// runnable app folder: `node server.js` and nothing else.
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standaloneAppRoot = path.join(webRoot, ".next", "standalone", "frontend");

if (!existsSync(standaloneAppRoot)) {
  console.error(`Standalone output not found at ${standaloneAppRoot} — did "next build" run with output: "standalone"?`);
  process.exit(1);
}

cpSync(path.join(webRoot, "public"), path.join(standaloneAppRoot, "public"), { recursive: true });
cpSync(path.join(webRoot, ".next", "static"), path.join(standaloneAppRoot, ".next", "static"), { recursive: true });

console.log(`Copied public/ and .next/static/ into ${standaloneAppRoot}`);
