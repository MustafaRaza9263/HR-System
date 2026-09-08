import { z } from "zod";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

export const assistantChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: objectId.optional(),
});

export const assistantSessionListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
});
