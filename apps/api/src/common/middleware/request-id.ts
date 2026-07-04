import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "X-Request-Id";

export interface RequestWithId extends Request {
  requestId: string;
}

// Server-generated, PII-free request identity. Caller-provided ids are
// intentionally ignored (never trusted, reflected, or logged).
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = `req_${randomBytes(12).toString("base64url")}`;
  (req as RequestWithId).requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
