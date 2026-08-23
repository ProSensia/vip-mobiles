"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authenticateOptional = authenticateOptional;
exports.requirePermission = requirePermission;
exports.requireAnyPermission = requireAnyPermission;
exports.requireSuperAdmin = requireSuperAdmin;
const jwt_1 = require("../utils/jwt");
const shared_1 = require("@vip/shared");
const errorHandler_1 = require("./errorHandler");
/** Populates req.user from the access token cookie. Rejects if missing/invalid. */
function authenticate(req, _res, next) {
    const token = req.cookies?.access_token;
    if (!token)
        return next(new errorHandler_1.ApiError(401, "Not authenticated"));
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = { id: payload.sub, role: payload.role, permissions: payload.permissions };
        next();
    }
    catch {
        next(new errorHandler_1.ApiError(401, "Session expired, please log in again"));
    }
}
/** Same as authenticate() but does not fail when no token is present. */
function authenticateOptional(req, _res, next) {
    const token = req.cookies?.access_token;
    if (!token)
        return next();
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = { id: payload.sub, role: payload.role, permissions: payload.permissions };
    }
    catch {
        // ignore invalid token on optional auth
    }
    next();
}
function requirePermission(...permissions) {
    return (req, _res, next) => {
        if (!req.user)
            return next(new errorHandler_1.ApiError(401, "Not authenticated"));
        const ok = permissions.every((p) => (0, shared_1.hasPermission)(req.user, p));
        if (!ok)
            return next(new errorHandler_1.ApiError(403, "You do not have permission to perform this action"));
        next();
    };
}
function requireAnyPermission(...permissions) {
    return (req, _res, next) => {
        if (!req.user)
            return next(new errorHandler_1.ApiError(401, "Not authenticated"));
        const ok = permissions.some((p) => (0, shared_1.hasPermission)(req.user, p));
        if (!ok)
            return next(new errorHandler_1.ApiError(403, "You do not have permission to perform this action"));
        next();
    };
}
function requireSuperAdmin(req, _res, next) {
    if (!req.user)
        return next(new errorHandler_1.ApiError(401, "Not authenticated"));
    if (req.user.role !== "SUPER_ADMIN")
        return next(new errorHandler_1.ApiError(403, "Super Admin access required"));
    next();
}
