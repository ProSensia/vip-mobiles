import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env, isProd } from "./env";
import { generalLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

import authRoutes from "./modules/auth/routes";
import userRoutes from "./modules/users/routes";
import brandRoutes from "./modules/brands/routes";
import categoryRoutes from "./modules/categories/routes";
import colorRoutes from "./modules/colors/routes";
import productRoutes from "./modules/products/routes";
import branchRoutes from "./modules/branches/routes";
import homepageRoutes from "./modules/homepage/routes";
import bannerRoutes from "./modules/banners/routes";
import buyRequestRoutes from "./modules/buyRequests/routes";
import salesRoutes from "./modules/sales/routes";
import socialRoutes from "./modules/social/routes";
import settingsRoutes from "./modules/settings/routes";
import auditRoutes from "./modules/audit/routes";
import mediaRoutes from "./modules/media/routes";
import systemRoutes from "./modules/system/routes";
import notificationRoutes from "./modules/notifications/routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }, // allow the Next.js app to load /uploads images
    })
  );
  app.use(cors({ origin: env.WEB_APP_URL, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(isProd ? "combined" : "dev"));
  app.use(generalLimiter);

  // Uploaded/optimized media: filenames are content-addressed (nanoid), so it's
  // safe to cache aggressively at the edge/browser.
  app.use(
    "/uploads",
    express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), {
      maxAge: "365d",
      immutable: true,
      etag: true,
    })
  );

  const healthCheck = (_req: express.Request, res: express.Response) =>
    res.json({ ok: true, time: new Date().toISOString() });
  app.get("/health", healthCheck);
  app.get("/api/health", healthCheck);

  // cPanel/Passenger's PassengerBaseURI path-mounting (e.g. this app claiming
  // "/api" under a shared domain) isn't guaranteed to strip that prefix
  // before handing the request to us — behavior differs by setup, and ours
  // is registered assuming the full "/api/..." path arrives intact (matching
  // local dev, where Next's rewrite forwards the full path unchanged). If the
  // prefix got stripped, put it back so every route below still matches.
  app.use((req, _res, next) => {
    if (!req.path.startsWith("/api/") && req.path !== "/health" && !req.path.startsWith("/uploads/")) {
      req.url = "/api" + req.url;
    }
    next();
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/brands", brandRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/colors", colorRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/branches", branchRoutes);
  app.use("/api/homepage-sections", homepageRoutes);
  app.use("/api/banners", bannerRoutes);
  app.use("/api/buy-requests", buyRequestRoutes);
  app.use("/api/sales", salesRoutes);
  app.use("/api/social", socialRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/audit-logs", auditRoutes);
  app.use("/api/media", mediaRoutes);
  app.use("/api/system", systemRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
