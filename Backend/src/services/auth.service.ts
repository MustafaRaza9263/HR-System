import bcrypt from "bcryptjs";
import type { Request } from "express";
import { Types } from "mongoose";

import { env } from "../config/env.js";
import { PASSWORD_HASH_ROUNDS } from "../constants/auth.js";
import { Session } from "../models/session.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/api-error.js";
import { hashToken, signSessionToken } from "../utils/token.js";

const DUMMY_PASSWORD_HASH = "$2b$12$A9PrUEj6XX3G4Lb791uZpeYCoXc2dVozIMkcQoYqM/dz42YLchiZa";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "hr";
}

interface Credentials {
  email: string;
  password: string;
}

interface Registration extends Credentials {
  name: string;
}

interface IssuedSession {
  token: string;
  expiresAt: Date;
  user: PublicUser;
}

function toPublicUser(user: { _id: Types.ObjectId; name: string; email: string; role: "hr" }): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function requestMetadata(request: Request): { ipAddress?: string; userAgent?: string } {
  const userAgent = request.get("user-agent")?.slice(0, 512);
  const ipAddress = request.ip?.slice(0, 64);
  return {
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

async function issueSession(
  user: { _id: Types.ObjectId; name: string; email: string; role: "hr" },
  request: Request,
): Promise<IssuedSession> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000);
  const sessionId = new Types.ObjectId();
  const token = await signSessionToken(
    { userId: user._id.toString(), sessionId: sessionId.toString() },
    expiresAt,
  );

  await Session.create({
    _id: sessionId,
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt,
    lastSeenAt: now,
    ...requestMetadata(request),
  });

  return { token, expiresAt, user: toPublicUser(user) };
}

export async function registerUser(
  registration: Registration,
  request: Request,
): Promise<IssuedSession> {
  const passwordHash = await bcrypt.hash(registration.password, PASSWORD_HASH_ROUNDS);

  try {
    const user = await User.create({
      name: registration.name,
      email: registration.email,
      passwordHash,
      role: "hr",
      active: true,
    });
    return issueSession(user, request);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11_000) {
      throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists.");
    }
    throw error;
  }
}

export async function loginUser(credentials: Credentials, request: Request): Promise<IssuedSession> {
  const user = await User.findOne({ email: credentials.email, active: true })
    .select("+passwordHash")
    .lean();
  const passwordMatches = await bcrypt.compare(
    credentials.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
  }

  return issueSession(user, request);
}
