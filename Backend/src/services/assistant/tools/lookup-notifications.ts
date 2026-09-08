import { z } from "zod";

import { escapeRegex } from "../../../utils/application-filter.js";
import { isoDate } from "../ids.js";
import { READ_COLLECTIONS, readDb } from "../read.js";
import { registerTool } from "./registry.js";

const inputSchema = z.object({
  unreadOnly: z.boolean().optional(),
  q: z.string().trim().max(120).optional(),
});

registerTool({
  name: "lookup_notifications",
  family: "data",
  label: "Checking notifications",
  description: "Read the shared HR notification feed (new applications, interview requests, completed interviews).",
  argsHint: '{"unreadOnly":false,"q":"optional search in title/body"}',
  inputSchema,
  async execute(input) {
    const filter: Record<string, unknown> = { targetRole: "hr" };
    if (input.unreadOnly === true) filter.isRead = false;
    if (input.q) {
      const rx = { $regex: escapeRegex(input.q), $options: "i" };
      filter.$or = [{ title: rx }, { body: rx }];
    }

    const rows = await readDb.find(READ_COLLECTIONS.notifications, filter, {
      projection: { type: 1, title: 1, body: 1, isRead: 1, createdAt: 1, refId: 1 },
      sort: { createdAt: -1 },
      limit: 20,
    });

    return {
      matchCount: rows.length,
      notifications: rows.map((row) => ({
        type: String(row.type ?? ""),
        title: String(row.title ?? ""),
        body: String(row.body ?? ""),
        isRead: Boolean(row.isRead),
        createdAt: isoDate(row.createdAt),
      })),
    };
  },
});
