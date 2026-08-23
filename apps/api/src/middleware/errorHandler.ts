import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { isProd } from "../env";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Validation failed",
      details: err.flatten().fieldErrors,
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  const anyErr = err as any;
  if (anyErr?.code === "P2002") {
    return res.status(409).json({ error: "A record with these details already exists" });
  }
  if (anyErr?.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }

  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    ...(isProd ? {} : { message: anyErr?.message, stack: anyErr?.stack }),
  });
}

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<any>>(
  fn: T
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
