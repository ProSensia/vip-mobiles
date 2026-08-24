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

// Passenger intercepts and manages this app's http.Server itself — it only
// honors the first listen() call and silently ignores any further ones
// ("http.Server.listen() was called more than once, ignore."). A prior
// attempt to bind a second, fixed-port listener here for the frontend to
// call directly never actually worked because of this — don't repeat that.
// env.PORT is whatever Passenger assigns (not the .env default), and isn't
// discoverable/stable from outside this process, so the frontend must reach
// this app through the public domain (routed by api/.htaccess's
// PassengerBaseURI) rather than a raw internal port.
tuneKeepAlive(
  app.listen(env.PORT, () => {
    console.log(`VIP Mobiles API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  })
);
