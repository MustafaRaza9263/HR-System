import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { SESSION_COOKIE_NAME } from "../constants/auth.js";
import { authenticate } from "../middleware/authenticate.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { Session } from "../models/session.model.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import { loginUser, registerUser } from "../services/auth.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { clearSessionCookie, setSessionCookie } from "../utils/cookies.js";
import { hashToken } from "../utils/token.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many authentication attempts. Try again later." },
  },
});

export const authRouter = Router();

authRouter.post(
  "/register",
  verifyBrowserOrigin,
  authLimiter,
  asyncHandler(async (request, response) => {
    const input = registerSchema.parse(request.body);
    const session = await registerUser(input, request);
    setSessionCookie(response, session.token, session.expiresAt);
    response.status(201).json({ data: { user: session.user, expiresAt: session.expiresAt } });
  }),
);

authRouter.post(
  "/login",
  verifyBrowserOrigin,
  authLimiter,
  asyncHandler(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const session = await loginUser(input, request);
    setSessionCookie(response, session.token, session.expiresAt);
    response.status(200).json({ data: { user: session.user, expiresAt: session.expiresAt } });
  }),
);

authRouter.get(
  "/me",
  authenticate,
  (request, response) => {
    response.status(200).json({ data: { user: request.auth!.user } });
  },
);

authRouter.post(
  "/logout",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const token = request.cookies[SESSION_COOKIE_NAME] as unknown;

    if (typeof token === "string" && token) {
      await Session.updateOne(
        { tokenHash: hashToken(token), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      ).exec();
    }

    clearSessionCookie(response);
    response.status(204).send();
  }),
);
