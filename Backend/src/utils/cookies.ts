import type { CookieOptions, Response } from "express";

import { env } from "../config/env.js";
import { SESSION_COOKIE_NAME } from "../constants/auth.js";

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookie(response: Response, token: string, expiresAt: Date): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions());
}
