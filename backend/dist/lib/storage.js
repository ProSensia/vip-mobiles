"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../env");
class LocalDiskStorage {
    root = path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR);
    async save(relativePath, data) {
        const fullPath = path_1.default.join(this.root, relativePath);
        await fs_1.default.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
        await fs_1.default.promises.writeFile(fullPath, data);
        return this.publicUrl(relativePath);
    }
    publicUrl(relativePath) {
        return `/uploads/${relativePath.replace(/\\/g, "/")}`;
    }
    async delete(publicUrl) {
        const relativePath = publicUrl.replace(/^\/uploads\//, "");
        const fullPath = path_1.default.join(this.root, relativePath);
        try {
            await fs_1.default.promises.unlink(fullPath);
        }
        catch (err) {
            if (err?.code !== "ENOENT")
                throw err;
        }
    }
}
exports.storage = new LocalDiskStorage();
