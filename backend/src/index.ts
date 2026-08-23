import { env } from "./env";
import { createApp } from "./app";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`VIP Mobiles API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

// Passenger assigns env.PORT itself (dynamically, not the .env default), so
// it isn't a stable address other apps on this server can rely on. Bind a
// second, loopback-only listener on a fixed port we fully control, purely so
// the frontend's server-side fetches (settings/catalog/session lookups on
// every page render) can reach us directly over localhost instead of
// round-tripping through the public domain and webserver on every request.
const INTERNAL_PORT = 4001;
app.listen(INTERNAL_PORT, "127.0.0.1", () => {
  console.log(`VIP Mobiles API also listening internally on http://127.0.0.1:${INTERNAL_PORT}`);
});
