import { PrismaClient } from "@vip/db";
import { isProd } from "../env";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: isProd ? ["error", "warn"] : ["error", "warn"],
  });

if (!isProd) global.__prisma = prisma;
