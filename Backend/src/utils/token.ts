import { createHash, randomBytes } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { env } from "../config/env.js";

const signingKey = new TextEncoder().encode(env.JWT_SECRET);

export interface SessionTokenPayload {
  userId: string;
  sessionId: string;
}

export async function signSessionToken(
  payload: SessionTokenPayload,
  expiresAt: Date,
): Promise<string> {
  return new SignJWT({ sid: payload.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1_000))
    .sign(signingKey);
}

export async function verifySessionToken(token: string): Promise<SessionTokenPayload> {
  const { payload } = await jwtVerify(token, signingKey, {
    algorithms: ["HS256"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  if (!payload.sub || typeof payload.sid !== "string") {
    throw new Error("Session token payload is invalid.");
  }

  return { userId: payload.sub, sessionId: payload.sid };
}

const GUEST_AUDIENCE = `${env.JWT_AUDIENCE}-guest`;

export interface GuestAccessPayload {
  registrantId: string;
  linkToken: string;
}

export async function signGuestAccessToken(payload: GuestAccessPayload, expiresAt: Date): Promise<string> {
  return new SignJWT({ tok: payload.linkToken })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.registrantId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(GUEST_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1_000))
    .sign(signingKey);
}

export async function verifyGuestAccessToken(token: string): Promise<GuestAccessPayload> {
  const { payload } = await jwtVerify(token, signingKey, {
    algorithms: ["HS256"],
    issuer: env.JWT_ISSUER,
    audience: GUEST_AUDIENCE,
  });

  if (!payload.sub || typeof payload.tok !== "string") {
    throw new Error("Guest access token payload is invalid.");
  }

  return { registrantId: payload.sub, linkToken: payload.tok };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}
