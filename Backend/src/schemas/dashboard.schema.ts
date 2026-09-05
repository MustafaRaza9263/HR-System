import { z } from "zod";

export const dashboardJobQuerySchema = z.object({
  job: z.string().trim().max(24).optional(),
});

export const dashboardTrendQuerySchema = dashboardJobQuerySchema.extend({
  granularity: z.enum(["daily", "weekly", "monthly", "yearly"]).optional().default("daily"),
});

export const dashboardUpcomingQuerySchema = z.object({
  day: z.enum(["today", "tomorrow"]).optional().default("today"),
});

export const dashboardActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(8),
});
