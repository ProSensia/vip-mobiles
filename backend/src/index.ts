import { env } from "./env";
import { createApp } from "./app";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`VIP Mobiles API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});
