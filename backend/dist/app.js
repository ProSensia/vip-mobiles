"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./env");
const rateLimit_1 = require("./middleware/rateLimit");
const errorHandler_1 = require("./middleware/errorHandler");
const routes_1 = __importDefault(require("./modules/auth/routes"));
const routes_2 = __importDefault(require("./modules/users/routes"));
const routes_3 = __importDefault(require("./modules/brands/routes"));
const routes_4 = __importDefault(require("./modules/categories/routes"));
const routes_5 = __importDefault(require("./modules/colors/routes"));
const routes_6 = __importDefault(require("./modules/products/routes"));
const routes_7 = __importDefault(require("./modules/branches/routes"));
const routes_8 = __importDefault(require("./modules/homepage/routes"));
const routes_9 = __importDefault(require("./modules/banners/routes"));
const routes_10 = __importDefault(require("./modules/buyRequests/routes"));
const routes_11 = __importDefault(require("./modules/sales/routes"));
const routes_12 = __importDefault(require("./modules/social/routes"));
const routes_13 = __importDefault(require("./modules/settings/routes"));
const routes_14 = __importDefault(require("./modules/audit/routes"));
const routes_15 = __importDefault(require("./modules/media/routes"));
const routes_16 = __importDefault(require("./modules/system/routes"));
function createApp() {
    const app = (0, express_1.default)();
    app.set("trust proxy", 1);
    app.use((0, helmet_1.default)({
        crossOriginResourcePolicy: { policy: "cross-origin" }, // allow the Next.js app to load /uploads images
    }));
    app.use((0, cors_1.default)({ origin: env_1.env.WEB_APP_URL, credentials: true }));
    app.use((0, cookie_parser_1.default)());
    app.use(express_1.default.json({ limit: "2mb" }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, morgan_1.default)(env_1.isProd ? "combined" : "dev"));
    app.use(rateLimit_1.generalLimiter);
    // Uploaded/optimized media: filenames are content-addressed (nanoid), so it's
    // safe to cache aggressively at the edge/browser.
    app.use("/uploads", express_1.default.static(path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR), {
        maxAge: "365d",
        immutable: true,
        etag: true,
    }));
    app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
    app.use("/api/auth", routes_1.default);
    app.use("/api/users", routes_2.default);
    app.use("/api/brands", routes_3.default);
    app.use("/api/categories", routes_4.default);
    app.use("/api/colors", routes_5.default);
    app.use("/api/products", routes_6.default);
    app.use("/api/branches", routes_7.default);
    app.use("/api/homepage-sections", routes_8.default);
    app.use("/api/banners", routes_9.default);
    app.use("/api/buy-requests", routes_10.default);
    app.use("/api/sales", routes_11.default);
    app.use("/api/social", routes_12.default);
    app.use("/api/settings", routes_13.default);
    app.use("/api/audit-logs", routes_14.default);
    app.use("/api/media", routes_15.default);
    app.use("/api/system", routes_16.default);
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
}
