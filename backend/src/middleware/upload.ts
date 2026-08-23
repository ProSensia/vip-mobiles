import multer from "multer";
import { env } from "../env";

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

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !ALLOWED_EXTENSIONS.test(file.originalname)) {
      cb(new Error("Only JPEG, PNG, WebP, AVIF or HEIC/HEIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});
