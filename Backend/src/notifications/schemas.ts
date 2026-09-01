import { z } from "zod";

export const fcmTokenSchema = z.object({
  token: z.string().trim().min(10, "FCM token is required.").max(4096),
});

export const listNotificationsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  unreadOnly: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
