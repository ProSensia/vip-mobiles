import { env } from "./env";
import { createApp } from "./app";

const app = createApp();

// Node's http.Server defaults to a 5s keepAliveTimeout. Next.js's internal
// proxy client (used for both our next.config.mjs rewrites and any fetch
// keep-alive pooling) can hold a connection open longer than that and try to
// reuse it — if the server has already silently closed the idle socket, the
// client's next write lands on a dead connection, surfacing as "socket hang
// up" / ECONNRESET. This was intermittently breaking /uploads image proxying
// (looked like broken/black images in the browser) and would affect any
// other proxied route the same way. headersTimeout must stay above
// keepAliveTimeout or Node warns/clamps it.
function tuneKeepAlive(server: import("http").Server) {
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

tuneKeepAlive(
  app.listen(env.PORT, () => {
    console.log(`VIP Mobiles API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  })
);

// Passenger assigns env.PORT itself (dynamically, not the .env default), so
// it isn't a stable address other apps on this server can rely on. Bind a
// second, loopback-only listener on a fixed port we fully control, purely so
// the frontend's server-side fetches (settings/catalog/session lookups on
// every page render) can reach us directly over localhost instead of
// round-tripping through the public domain and webserver on every request.
const INTERNAL_PORT = 4001;
tuneKeepAlive(
  app.listen(INTERNAL_PORT, "127.0.0.1", () => {
    console.log(`VIP Mobiles API also listening internally on http://127.0.0.1:${INTERNAL_PORT}`);
  })
);
