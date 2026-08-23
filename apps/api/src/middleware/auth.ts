import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { hasPermission, type Permission } from "@vip/shared";
import { ApiError } from "./errorHandler";

/** Populates req.user from the access token cookie. Rejects if missing/invalid. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) return next(new ApiError(401, "Not authenticated"));

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, permissions: payload.permissions };
    next();
  } catch {
    next(new ApiError(401, "Session expired, please log in again"));
  }
}

/** Same as authenticate() but does not fail when no token is present. */
export function authenticateOptional(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, permissions: payload.permissions };
  } catch {
    // ignore invalid token on optional auth
  }
  next();
}

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "Not authenticated"));
    const ok = permissions.every((p) => hasPermission(req.user!, p));
    if (!ok) return next(new ApiError(403, "You do not have permission to perform this action"));
    next();
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "Not authenticated"));
    const ok = permissions.some((p) => hasPermission(req.user!, p));
    if (!ok) return next(new ApiError(403, "You do not have permission to perform this action"));
    next();
  };
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new ApiError(401, "Not authenticated"));
  if (req.user.role !== "SUPER_ADMIN") return next(new ApiError(403, "Super Admin access required"));
  next();
}
