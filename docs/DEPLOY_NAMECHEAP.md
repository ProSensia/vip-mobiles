# Deploying to Namecheap (cPanel Shared/Business Hosting)

This covers Namecheap's cPanel-based shared/business hosting, which manages
Node.js for you through cPanel's **Setup Node.js App** tool (built on
CloudLinux's Node.js Selector + Phusion Passenger). You pick a Node version
in the UI and cPanel handles installing and running it — you never install
Node by hand.

**`backend/` and `frontend/` are fully independent projects.** Each has its
own `package.json` with real, registry-published dependencies — no npm
workspaces, no monorepo-root install required. You `cd` into one and run
`npm install` exactly like any ordinary Node project. `packages/shared` and
`packages/db` still exist in the repo as the source of truth for a few small
files (see "Keeping things in sync" below), but neither app depends on them
at install time anymore.

## 0. What you'll end up with

- One MySQL database (cPanel → MySQL Databases)
- Two cPanel "Node.js Apps", each pointed at its own **sibling** subfolder —
  neither is nested inside the other's Application Root, which is what
  cPanel requires:

  | | App Root Directory | Startup file |
  |---|---|---|
  | Backend | `vipmobile.prosensia.pk/backend` | `dist/index.js` |
  | Frontend | `vipmobile.prosensia.pk/frontend` | `server.js` |

## 1. Get the code onto the server

**Option A — cPanel Git Version Control (recommended, keeps you on GitHub)**

1. cPanel → **Git Version Control** → **Create**.
2. Clone URL: `https://github.com/ProSensia/vip-mobiles.git` (use a
   [GitHub personal access token](https://github.com/settings/tokens) as the
   password if prompted, since the repo is private).
3. Repository Path: `vipmobile.prosensia.pk` (your account's home-relative
   folder for this domain — it does **not** need to be inside `public_html`,
   since Passenger serves each app directly, not static files).
4. After creating it, whenever you push new commits to GitHub: open the repo
   in cPanel → **Pull or Deploy** tab → **Update from Remote**, then
   **Deploy HEAD Commit** (runs `.cpanel.yml`, which just confirms the pull —
   see that file's comments for why it doesn't auto-run install/build).

**Option B — plain SSH**

```bash
ssh prosdfwo@premium281.web-hosting.com
git clone https://github.com/ProSensia/vip-mobiles.git vipmobile.prosensia.pk
```

## 2. Create the MySQL database

cPanel → **MySQL Databases** — already done if you've followed along:
database `prosdfwo_vipmobiles`, user `prosdfwo_vipmobiles`, full privileges.
Connection string (note `%40` for the literal `@` in the password — `@` is a
separator character in connection strings, so it must be encoded):

```
mysql://prosdfwo_vipmobiles:VipMobiles%402026@localhost:3306/prosdfwo_vipmobiles
```

## 3. Set up the backend

cPanel → **Setup Node.js App** → **Create Application**:

- **Node.js version**: 20 or 22 (cPanel often pre-fills something ancient
  like 10.x — change it)
- **Application mode**: Production
- **Application root**: `vipmobile.prosensia.pk/backend`
- **Application URL**: a subdomain, e.g. `api.vipmobile.prosensia.pk`
  (create the subdomain first in cPanel → Domains, if it doesn't exist —
  keep this a **subdomain**, not a `/api` path suffix on the main domain:
  the backend's own routes already start with `/api/...` internally, and
  stacking cPanel's own path-based proxy prefix on top of that would very
  likely double it and break every request)
- **Application startup file**: `dist/index.js`

Click **Create**, then open the virtual environment cPanel gives you
(via **Terminal** or SSH) and run:

```bash
cd ~/vipmobile.prosensia.pk/backend
npm install
npm run build          # runs `prisma generate` then compiles TypeScript
```

Environment Variables for this app (**Setup Node.js App** → this app →
**Environment Variables**):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the connection string from step 2 |
| `JWT_ACCESS_SECRET` | generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | a **different** generated value |
| `WEB_APP_URL` | `https://vipmobile.prosensia.pk` |
| `COOKIE_DOMAIN` | `.vipmobile.prosensia.pk` (leading dot, so it's shared with the frontend) |
| `UPLOAD_DIR` | `uploads` |

## 4. Install the database schema

Two ways — pick whichever's easier:

**Terminal**, from the repo root (this one step still uses the root — it's
the seed/migration tooling in `packages/db`, not either deployed app):

```bash
cd ~/vipmobile.prosensia.pk
npm install
npm run db:migrate:deploy
npm run db:seed          # optional: demo catalog/branches/staff — see README
```

**phpMyAdmin** (no terminal needed): cPanel → **phpMyAdmin** → select
`prosdfwo_vipmobiles` → **SQL** tab → paste the full contents of
[`packages/db/prisma/migrations/20260823000000_init/migration.sql`](../packages/db/prisma/migrations/20260823000000_init/migration.sql)
→ **Go**. You should see 20 tables appear. The demo-data seed script still
needs the terminal (it's a Node script, not raw SQL), so this route starts
with an empty schema — configure everything from scratch in the admin.

Click **Restart** on the backend app.

## 5. Set up the frontend

cPanel → **Setup Node.js App** → **Create Application**:

- **Node.js version**: same as backend
- **Application mode**: Production
- **Application root**: `vipmobile.prosensia.pk/frontend`
- **Application URL**: your main domain, `vipmobile.prosensia.pk`
- **Application startup file**: `server.js`

Environment Variables:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `API_INTERNAL_URL` | `http://127.0.0.1:<backend app's port>` — shown on the backend app's Setup Node.js App page |
| `NEXT_PUBLIC_SITE_URL` | `https://vipmobile.prosensia.pk` |

Open this app's virtual environment terminal and run:

```bash
cd ~/vipmobile.prosensia.pk/frontend
npm install
npm run build
```

Click **Restart**. Visit `vipmobile.prosensia.pk` — the storefront should
load, and `/login` should reach the admin/portal sign-in page.

## 6. Redeploying after future changes

```bash
cd ~/vipmobile.prosensia.pk
git pull
```

Then, for whichever app actually changed:

```bash
cd backend && npm install && npm run build       # if backend changed
cd frontend && npm install && npm run build       # if frontend changed
```

If the database schema changed, also re-run step 4's migrate/phpMyAdmin
step. Click **Restart** on whichever app(s) you rebuilt — rebuild first,
restart second; a restart alone won't pick up a build you haven't re-run.

## Keeping things in sync

`backend/src/shared.ts` and `frontend/src/shared.ts` are generated copies of
`packages/shared/src/*.ts`, and `backend/prisma/schema.prisma` is a copy of
`packages/db/prisma/schema.prisma` (with the custom `output` path stripped,
since standalone Prisma generates straight into `backend/node_modules/@prisma/client`
instead). If you change any of the source files in `packages/`, resync both
copies with one command from the repo root:

```bash
node scripts/sync-standalone.mjs
```

Commit the regenerated files alongside your source change.

## 7. Before going live

Once you're happy everything works with the demo data, go to
**Admin → Go-Live Setup** in the site itself (or run `npm run db:reset` from
`~/vipmobile.prosensia.pk` with `packages/db` installed) to wipe the seeded
demo catalog/staff/sales and configure real store settings. See the main
[README](../README.md) for what that does and preserves.

## Troubleshooting

- **502 / "Passenger" error page**: usually means the startup file crashed.
  Check **Setup Node.js App** → your app → there's a link to its error log.
  A missing/incorrect environment variable (especially `DATABASE_URL`) is
  the most common cause.
- **`npm error 404 '@vip/shared@*' is not in this registry`**: this means
  you're running an older clone from before the standalone restructure, or
  `git pull` didn't actually update — re-run `git pull` from
  `~/vipmobile.prosensia.pk` and confirm `backend/src/shared.ts` exists
  before running `npm install` again.
- **cPanel error: "The application cannot be located inside of already
  existing one"**: one app's Application Root is a subfolder of the other's.
  `backend` and `frontend` must be **siblings** — `vipmobile.prosensia.pk/backend`
  and `vipmobile.prosensia.pk/frontend` — never one set to the parent of the
  other.
- **Images not showing**: confirm `UPLOAD_DIR` for the backend app resolves
  to a writable folder (relative to `vipmobile.prosensia.pk/backend`) and
  that `API_INTERNAL_URL` on the frontend app points at the backend's real
  internal port.
- **npm install runs out of memory** on a low-tier plan: dev dependencies
  (typescript, prisma CLI, etc.) are only needed to build, not to run the
  compiled output — after a successful build you can `npm prune --omit=dev`
  in that app's folder to shrink its running footprint, or ask Namecheap
  support to temporarily raise your account's process memory limit for the
  install.
