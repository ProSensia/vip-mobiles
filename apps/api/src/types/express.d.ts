import type { RoleName, PermissionOverrides } from "@vip/shared";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: RoleName;
        permissions?: PermissionOverrides | null;
      };
    }
  }
}

export {};
