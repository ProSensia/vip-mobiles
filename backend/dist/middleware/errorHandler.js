"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
const zod_1 = require("zod");
const env_1 = require("../env");
class ApiError extends Error {
    status;
    details;
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
exports.ApiError = ApiError;
function notFoundHandler(req, res) {
    res.status(404).json({ error: "Not found", path: req.originalUrl });
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorHandler(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        return res.status(422).json({
            error: "Validation failed",
            details: err.flatten().fieldErrors,
        });
    }
    if (err instanceof ApiError) {
        return res.status(err.status).json({ error: err.message, details: err.details });
    }
    const anyErr = err;
    if (anyErr?.code === "P2002") {
        return res.status(409).json({ error: "A record with these details already exists" });
    }
    if (anyErr?.code === "P2025") {
        return res.status(404).json({ error: "Record not found" });
    }
    console.error(err);
    res.status(500).json({
        error: "Internal server error",
        ...(env_1.isProd ? {} : { message: anyErr?.message, stack: anyErr?.stack }),
    });
}
function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
