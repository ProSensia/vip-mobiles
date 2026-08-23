"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./env");
const app_1 = require("./app");
const app = (0, app_1.createApp)();
app.listen(env_1.env.PORT, () => {
    console.log(`VIP Mobiles API listening on http://localhost:${env_1.env.PORT} [${env_1.env.NODE_ENV}]`);
});
