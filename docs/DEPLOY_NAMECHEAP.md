# Deploying to Namecheap (cPanel Shared/Business Hosting)

This covers Namecheap's cPanel-based shared/business hosting, which manages
Node.js for you through cPanel's **Setup Node.js App** tool (built on
CloudLinux's Node.js Selector + Phusion Passenger). You pick a Node version
in the UI and cPanel handles installing and running it — you never install
Node by hand.

This app needs **two** long-running Node processes (the API and the web
frontend) plus a **MySQL database**, all of which a Namecheap shared/business
plan provides.

## 0. What you'll end up with

- One MySQL database (cPanel → MySQL Databases)
- Two cPanel "Node.js Apps": one running `apps/api`, one running `apps/web`
- Both apps pointed at **the same repo checkout** (Application Root = the
  repo root) — npm workspaces need to be installed from the root, not from
  inside a subfolder, so this isn't optional

## 1. Get the code onto the server

**Option A — cPanel Git Version Control (recommended, keeps you on GitHub)**

1. cPanel → **Git Version Control** → **Create**.
2. Clone URL: `https://github.com/ProSensia/vip-mobiles.git` (use a
   [GitHub personal access token](https://github.com/settings/tokens) as the
   password if prompted, since the repo is private).
3. Repository Path: something like `repositories/vip-mobiles` (anywhere
   under your home directory — it does **not** need to be inside
   `public_html`, since Passenger serves the app directly, not static files).
4. After creating it, whenever you push new commits to GitHub: open the repo
   in cPanel → **Pull or Deploy** tab → **Update from Remote**, then
   **Deploy HEAD Commit** (this runs `.cpanel.yml`, which just confirms the
   deploy — see that file's comments for why it doesn't auto-run
   install/build).

**Option B — plain SSH**

```bash
ssh yourusername@yourdomain.com
git clone https://github.com/ProSensia/vip-mobiles.git repositories/vip-mobiles
```

## 2. Create the MySQL database

cPanel → **MySQL Databases**:

1. Create a database, e.g. `yourcpanelusername_vipmobiles`.
2. Create a user with a strong password, add it to the database with **All
   Privileges**.
3. Note the full database name, username and host — on shared hosting the
   host is almost always `localhost`. Your connection string will be:

   ```
   mysql://yourcpanelusername_dbuser:PASSWORD@localhost:3306/yourcpanelusername_vipmobiles
   ```

   If your password contains `@`, `:`, `/`, `?`, `#`, or `%`, URL-encode just
   that character (`@` → `%40`, etc.) — connection strings use those
   characters as separators, so a literal one in the password breaks parsing.

## 3. Set up the API app

cPanel → **Setup Node.js App** → **Create Application**:

- **Node.js version**: latest available (needs 18.18+; pick 20 or 22 if offered)
- **Application mode**: Production
- **Application root**: `repositories/vip-mobiles` (the repo root from step 1)
- **Application URL**: a subdomain, e.g. `api.yourdomain.com` (create the
  subdomain first in cPanel → Domains, if it doesn't exist)
- **Application startup file**: `apps/api/dist/index.js`

Click **Create**. cPanel shows a command to enter the app's virtual
environment, e.g.:

```bash
source /home/yourcpanelusername/nodevenv/repositories/vip-mobiles/20/bin/activate && cd /home/yourcpanelusername/repositories/vip-mobiles
```

Run that (via cPanel's **Terminal** or SSH), then:

```bash
npm install                              # installs all workspaces
npm run build --workspace=packages/shared
npm run generate --workspace=packages/db
npm run build --workspace=apps/api
```

Back in **Setup Node.js App** → your API app → **Environment Variables**,
add (values from `apps/api/.env.example`):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the connection string from step 2 |
| `JWT_ACCESS_SECRET` | generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | a **different** generated value |
| `WEB_APP_URL` | `https://yourdomain.com` (your frontend's real URL) |
| `COOKIE_DOMAIN` | `.yourdomain.com` (leading dot, so it's shared with the frontend) |
| `UPLOAD_DIR` | `uploads` |

Install the schema once — either from the virtual environment terminal:

```bash
npm run migrate:deploy --workspace=packages/db
npm run seed --workspace=packages/db     # optional: demo data — see README
```

...or, if you'd rather not use the terminal at all, open cPanel →
**phpMyAdmin**, select your database, open the **SQL** tab, and paste in the
full contents of
[`packages/db/prisma/migrations/20260823000000_init/migration.sql`](../packages/db/prisma/migrations/20260823000000_init/migration.sql)
(generated straight from `prisma/schema.prisma`, so it's always in sync).
Click **Go** — you should see 20 tables appear. The demo-data seed script
still needs the terminal (it's a Node script, not raw SQL), so if you go the
phpMyAdmin route you'll start with an empty schema and configure everything
from scratch in the admin.

Click **Restart** on the API app.

## 4. Set up the web app

The frontend builds to a **self-contained folder** (`next build`'s
`output: "standalone"` mode) — `apps/web/.next/standalone/apps/web/` ends up
with its own `server.js` and its own `node_modules`, so this one app doesn't
need a workspace-aware `npm install` in its Application Root the way the API
does. That folder is what you point cPanel at directly.

First build it. From the **API app's** virtual environment (or any shell
with the repo's `npm install` already done, per step 3) run:

```bash
cd ~/repositories/vip-mobiles
npm run build --workspace=apps/web
```

This produces `apps/web/.next/standalone/apps/web/` — a complete, directly
runnable copy of the frontend (the build script copies `public/` and
`.next/static/` into it automatically, since Next doesn't do that on its
own).

Now, **Setup Node.js App** → **Create Application**:

- **Application root**: `repositories/vip-mobiles/apps/web/.next/standalone/apps/web`
- **Application URL**: your main domain, e.g. `yourdomain.com`
- **Application startup file**: `server.js`

Environment Variables for this app:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `API_INTERNAL_URL` | `http://127.0.0.1:<API app's port>` — shown on the API app's Setup Node.js App page |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` |

Click **Restart** on the web app. Visit your domain — the storefront should
load, and `/admin`/`/portal` should reach the login page.

<details>
<summary>Alternative: skip standalone mode</summary>

If you'd rather not rebuild after every deploy, or the standalone path feels
fragile on your account, you can instead point this app's Application Root
at the repo root (same as the API) with startup file `apps/web/server.js` —
a plain custom-server wrapper that also works, at the cost of running from
the full (larger) monorepo `node_modules` instead of a pruned folder.

</details>

## 5. Redeploying after future changes

1. Push to GitHub as usual.
2. cPanel → Git Version Control → your repo → **Update from Remote** → **Deploy HEAD Commit**.
3. From the virtual environment(s): re-run whichever of `npm install`,
   `npm run build --workspace=...`, or `npm run migrate:deploy --workspace=packages/db`
   are relevant to what changed.
4. Click **Restart** on whichever app(s) changed (Setup Node.js App page).

## 6. Before going live

Once you're happy everything works with the demo data, go to
**Admin → Go-Live Setup** in the site itself (or run
`npm run db:reset --workspace=packages/db` from the virtual environment) to
wipe the seeded demo catalog/staff/sales and configure real store settings.
See the main [README](../README.md) for what that does and preserves.

## Troubleshooting

- **502 / "Passenger" error page**: usually means the startup file crashed.
  Check **Setup Node.js App** → your app → there's a link to its error log.
  A missing/incorrect environment variable (especially `DATABASE_URL`) is
  the most common cause.
- **"Cannot find module '@vip/shared'"** (API app, or the web app if you're
  using the non-standalone alternative): `npm install` was run somewhere
  other than the repo root, so npm workspaces didn't link it — re-run
  `npm install` from `repositories/vip-mobiles` (Application Root), not from
  inside `apps/api` or `apps/web`.
- **Web app serves stale content after a redeploy**: `next build` rewrites
  `apps/web/.next/standalone/apps/web/` from scratch each time, so re-running
  the build then clicking **Restart** (in that order) on the web app is
  required — a restart alone won't pick up a build you haven't re-run yet.
- **Images not showing**: confirm `UPLOAD_DIR` for the API app resolves to a
  writable folder (it's relative to the API's Application Root) and that
  `API_INTERNAL_URL` on the web app points at the API's real internal port.
- **npm install runs out of memory** on a low-tier plan: run
  `npm install --omit=dev` for the *running* app after building once with
  dev dependencies included elsewhere (dev deps are only needed to build,
  not to run the compiled/built output) — or ask Namecheap support to
  temporarily bump your account's process memory limit for the install.
