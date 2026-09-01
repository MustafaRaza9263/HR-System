import "dotenv/config";

import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalEnvString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required."),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must contain at least 32 characters."),
    JWT_ISSUER: z.string().min(1).default("hr-system-api"),
    JWT_AUDIENCE: z.string().min(1).default("hr-system-frontend"),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    CORS_ORIGINS: z.string().min(1).default("http://localhost:3000"),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    TRUST_PROXY: z.union([z.coerce.number().int().min(0), booleanFromString]).default(0),
    FIREBASE_PROJECT_ID: optionalEnvString,
    FIREBASE_CLIENT_EMAIL: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().email().optional(),
    ),
    FIREBASE_PRIVATE_KEY: optionalEnvString,
  })
  .superRefine((values, context) => {
    if (values.COOKIE_SAME_SITE === "none" && values.NODE_ENV !== "production") {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SAME_SITE"],
        message: "COOKIE_SAME_SITE=none requires production HTTPS cookies.",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const cookieDomain = parsed.data.COOKIE_DOMAIN?.trim() || undefined;

export const env = {
  ...parsed.data,
  COOKIE_DOMAIN: cookieDomain,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  FRONTEND_URL: parsed.data.FRONTEND_URL.replace(/\/$/, ""),
  FIREBASE_PRIVATE_KEY: parsed.data.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
} as const;
