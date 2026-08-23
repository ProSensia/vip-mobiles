"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../env");
const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/heic",
    "image/heif",
]);
// Some browsers/OSes report HEIC uploads with a generic mimetype
// (application/octet-stream) instead of image/heic — fall back to the file
// extension so real phone-camera photos aren't rejected before they ever
// reach the HEIC-aware conversion step in utils/image.ts.
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|avif|heic|heif)$/i;
exports.imageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: env_1.env.MAX_UPLOAD_MB * 1024 * 1024, files: 20 },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !ALLOWED_EXTENSIONS.test(file.originalname)) {
            cb(new Error("Only JPEG, PNG, WebP, AVIF or HEIC/HEIF images are allowed"));
            return;
        }
        cb(null, true);
    },
});
