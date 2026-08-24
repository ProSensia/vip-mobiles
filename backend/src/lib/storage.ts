import fs from "fs";
import path from "path";
import { env } from "../env";

// Storage is behind a small interface so the local-disk driver used in
// development can be swapped for a cloud driver (S3/R2/GCS) in production
// without touching the image-processing pipeline that calls it.
export interface StorageDriver {
  save(relativePath: string, data: Buffer): Promise<string>; // returns public URL
  publicUrl(relativePath: string): string;
  /** Removes a file previously returned by save()/publicUrl(). Safe to call on an already-missing file. */
  delete(publicUrl: string): Promise<void>;
}

class LocalDiskStorage implements StorageDriver {
  private root = path.resolve(process.cwd(), env.UPLOAD_DIR);

  async save(relativePath: string, data: Buffer): Promise<string> {
    const fullPath = path.join(this.root, relativePath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, data);
    return this.publicUrl(relativePath);
  }

  publicUrl(relativePath: string): string {
    return `/uploads/${relativePath.replace(/\\/g, "/")}`;
  }

  async delete(publicUrl: string): Promise<void> {
    const relativePath = publicUrl.replace(/^\/uploads\//, "");
    const fullPath = path.join(this.root, relativePath);
    try {
      await fs.promises.unlink(fullPath);
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
    }
  }
}

export const storage: StorageDriver = new LocalDiskStorage();
