# VIP Mobiles — Store Platform

A full-stack mobile store platform: storefront, admin CMS, sales portal, and a
social-media creative generator, built around the VIP Mobiles brand (black &
gold, premium/luxury positioning).

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS |
| Backend API | Node.js, Express, TypeScript |
| Database | MySQL 8, via Prisma ORM |
| Auth | JWT (access + rotating refresh tokens) in httpOnly cookies, RBAC |
| Images | `sharp` — WebP + AVIF, multiple responsive sizes, local disk storage |
| Social creatives | Server-side SVG/Canvas rendering via `sharp` |

## Project Structure

```
apps/
  web/    Next.js app — storefront, /admin CMS, /portal (sales staff)
  api/    Express API — all business logic, auth, image processing, DB access
packages/
  db/     Prisma schema, migrations, seed & reset scripts
  shared/ Code shared between web and api (permissions, brand tokens, utils)
Logo/     Original brand asset
```

The web app and API are separate processes. In development, Next.js proxies
`/api/*` and `/uploads/*` to the API (see `apps/web/next.config.mjs`) so
cookies stay same-origin. In production, put them behind the same reverse
proxy (nginx/Caddy) using the same rewrite rules, or run them on subdomains
with `COOKIE_DOMAIN` set accordingly.

## Prerequisites

- Node.js 18.18+ (Node 22 recommended)
- A MySQL 8 database — either:
  - Docker: `docker compose up -d` (starts MySQL + phpMyAdmin on :8080), or
  - A local MySQL install (e.g. XAMPP/WAMP on Windows), or
  - A managed MySQL instance (RDS, PlanetScale in MySQL mode, etc.)

## First-Time Setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure environment files
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit packages/db/.env and apps/api/.env with your real DATABASE_URL and a
# strong SUPER_ADMIN_PASSWORD / JWT secrets.

# 3. Create the database schema
npm run db:migrate

# 4. Generate the Prisma client (also runs automatically after migrate)
npm run db:generate

# 5. Seed demo data (Super Admin account + realistic demo catalog/branches/staff)
npm run db:seed

# 6. Start both apps
npm run dev
```

- Storefront: http://localhost:3000
- Admin/Portal login: http://localhost:3000/login
- API health check: http://localhost:4000/health

Log in with the `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` you set in
`packages/db/.env`. Demo staff accounts (Sales Manager, Sales Staff, Content
Manager, Admin) are created with the password `Demo@1234` — see the seed
script output for their emails.

## Going Live (removing demo data)

The seed script creates realistic demo products, brands, categories, colors,
branches, staff and sales — all flagged internally as demo data. None of it
is hard-coded into the application; it only exists in the database.

Before handing the site to a client:

1. Configure real store settings (Admin → Store Settings): logo, WhatsApp
   number, social links, SEO defaults.
2. Add real branches, staff, products, etc. (or keep/edit the demo ones).
3. Go to **Admin → Go-Live Setup** and run "Reset Demo Data" (Super Admin
   only, requires your password + a typed confirmation). This permanently
   removes every demo-flagged record while preserving your Super Admin
   account and anything real you've entered.

Equivalent CLI command: `npm run db:reset`.

## Roles & Permissions

| Role | Scope |
|---|---|
| Super Admin | Full access, including staff role management and demo-data reset |
| Admin | Full administrative access (not role elevation or system reset) |
| Content Manager | Products, catalog, homepage, banners, social generator |
| Sales Manager | Sales recording + full analytics, branches, buy requests |
| Sales Staff | Assigned products, stock updates, recording their own sales |

Permissions are enforced on the API (`apps/api/src/middleware/auth.ts`,
`packages/shared/src/permissions.ts`) — the frontend only uses them to hide
UI, never as the source of truth. Super Admin can grant/revoke individual
permissions per user from **Admin → Staff & Roles**.

## Key Workflows

- **Buy requests**: no checkout — "Request to Buy" opens a short form, then
  deep-links to WhatsApp with a pre-filled message (see
  `packages/shared/src/whatsapp.ts`). The WhatsApp number is configured in
  Admin → Store Settings.
- **Stock states**: Available / Reserved / Sold / Hidden. Marking a product
  Sold removes it from featured/available listings but keeps it searchable
  and visibly marked "Sold" — its history (price, sale record) is preserved.
- **Social generator**: Admin → Social Generator picks a product, platform
  (Instagram/TikTok), background style and which elements to show, then
  renders a branded creative server-side and offers it for download.

## Useful Scripts

```bash
npm run dev              # run API + web together
npm run build             # build db client + api + web
npm run db:studio         # Prisma Studio (visual DB browser)
npm run db:seed           # (re-)seed demo data
npm run db:reset          # remove demo data via CLI (same as the admin UI action)
npm run lint               # lint web + api
npm run typecheck          # typecheck all workspaces
```

## Deployment Notes

- Run `apps/api` as a persistent Node process (PM2/systemd/Docker) — it
  serves `/uploads` directly and needs a writable `UPLOAD_DIR`.
- Run `apps/web` with `next start` behind the same domain/proxy as the API,
  using the rewrite rules in `next.config.mjs` (or equivalent reverse-proxy
  rules) so `/api/*` and `/uploads/*` stay same-origin for cookies.
- Set `NODE_ENV=production`, strong `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`,
  and `COOKIE_DOMAIN` to your real domain.
- Point `DATABASE_URL` at your production MySQL instance and run
  `npm run db:migrate:deploy` (not `db:migrate`, which is for dev).
- For image storage beyond a single server's disk, swap the driver in
  `apps/api/src/lib/storage.ts` (interface is already storage-backend
  agnostic) for S3/R2/GCS.

## Security Notes

- `npm audit` is clean for everything this project directly depends on.
  Next.js itself currently bundles its own internal copies of `sharp` and
  `postcss` with known high-severity advisories; the fix is a Next 16 major
  upgrade, which is a breaking change not yet applied here to avoid
  destabilizing a verified build. Run `npm audit` periodically and plan that
  upgrade during a maintenance window — see https://pris.ly/d/major-version-upgrade
  for the equivalent Prisma guidance and the Next.js release notes for its own.
- Product image uploads are validated and re-encoded server-side (this
  project's own `sharp` dependency, kept current) before ever being stored or
  served — uploaded bytes are never passed through untouched.
- All write endpoints are permission-checked on the API, not just hidden in
  the UI. Rate limiting is applied to auth and public form endpoints.
