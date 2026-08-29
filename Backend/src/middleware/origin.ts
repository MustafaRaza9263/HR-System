import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

export const verifyBrowserOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get("origin");
  if (origin && !env.CORS_ORIGINS.includes(origin)) {
    next(new ApiError(403, "INVALID_ORIGIN", "This request origin is not allowed."));
    return;
  }
  next();
};
