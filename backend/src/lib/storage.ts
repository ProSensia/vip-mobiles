import fs from "fs";
import path from "path";
import { env } from "../env";

// Storage is behind a small interface so the local-disk driver used in
// development can be swapped for a cloud driver (S3/R2/GCS) in production
// without touching the image-processing pipeline that calls it.
export interface StorageDriver {
  save(relativePath: string, data: Buffer): Promise<string>; // returns public URL
  publicUrl(relativePath: string): string;
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
}

export const storage: StorageDriver = new LocalDiskStorage();
