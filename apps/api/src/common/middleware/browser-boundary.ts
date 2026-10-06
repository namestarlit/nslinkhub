import type { NextFunction, Request, Response } from "express";
import type { RequestWithId } from "./request-id";

// Cookie authority requires an explicit browser origin, even if a bearer is
// also present. Cookie-free API/extension clients keep their bearer contract.
export function browserBoundary(origin: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    const session = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(
      req.headers.cookie ?? "",
    );
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      session &&
      req.headers.origin !== origin
    ) {
      req.resume();
      res.status(403).json({
        error: {
          code: "forbidden",
          message: "Forbidden",
          requestId: (req as RequestWithId).requestId,
          details: {},
        },
      });
      return;
    }
    next();
  };
}
