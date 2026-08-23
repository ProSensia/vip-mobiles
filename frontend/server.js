// Passenger (cPanel's "Setup Node.js App") requires a plain Node entry point
// that starts listening on process.env.PORT when required — it doesn't run
// arbitrary CLI commands like `next start`, so this replaces that for
// production hosting. Not used in local dev (`npm run dev` still uses the
// Next CLI directly); only invoked via `npm start` / cPanel's startup file.
const { createServer } = require("http");
const next = require("next");

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`VIP Mobiles web listening on port ${port}`);
  });
});
