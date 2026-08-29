import type { RequestHandler } from "express";
import { Types } from "mongoose";

import { LAST_SEEN_WRITE_INTERVAL_MS, SESSION_COOKIE_NAME } from "../constants/auth.js";
import { Session } from "../models/session.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/api-error.js";
import { hashToken, verifySessionToken } from "../utils/token.js";
import { asyncHandler } from "../utils/async-handler.js";

export const authenticate: RequestHandler = asyncHandler(async (request, _response, next) => {
  const token = request.cookies[SESSION_COOKIE_NAME] as unknown;
  if (typeof token !== "string" || !token) {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  let payload: Awaited<ReturnType<typeof verifySessionToken>>;
  try {
    payload = await verifySessionToken(token);
  } catch {
    throw new ApiError(401, "INVALID_SESSION", "The session is invalid or has expired.");
  }

  if (!Types.ObjectId.isValid(payload.sessionId) || !Types.ObjectId.isValid(payload.userId)) {
    throw new ApiError(401, "INVALID_SESSION", "The session is invalid or has expired.");
  }

  const now = new Date();
  const session = await Session.findOne({
    _id: payload.sessionId,
    userId: payload.userId,
    tokenHash: hashToken(token),
    revokedAt: null,
    expiresAt: { $gt: now },
  })
    .select("+tokenHash lastSeenAt")
    .lean();

  if (!session) {
    throw new ApiError(401, "INVALID_SESSION", "The session is invalid or has expired.");
  }

  const user = await User.findOne({ _id: payload.userId, active: true }).lean();
  if (!user) {
    throw new ApiError(401, "INVALID_SESSION", "The session is invalid or has expired.");
  }

  if (now.getTime() - session.lastSeenAt.getTime() >= LAST_SEEN_WRITE_INTERVAL_MS) {
    await Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: now } }).exec();
  }

  request.auth = {
    sessionId: session._id,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
  next();
});
