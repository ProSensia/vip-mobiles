import type { RoleName, PermissionOverrides } from "../shared";

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
