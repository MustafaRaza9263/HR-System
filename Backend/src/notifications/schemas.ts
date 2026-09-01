import { z } from "zod";

export const fcmTokenSchema = z.object({
  token: z.string().trim().min(10, "FCM token is required.").max(4096),
});
