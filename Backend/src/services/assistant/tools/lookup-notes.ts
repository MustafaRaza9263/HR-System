import { z } from "zod";

import { asObjectId, idString, isoDate } from "../ids.js";
import { READ_COLLECTIONS, readDb } from "../read.js";
import { registerTool } from "./registry.js";

const inputSchema = z.object({
  interviewId: z.string().trim().min(24).max(24),
});

registerTool({
  name: "lookup_interview_notes",
  family: "data",
  label: "Checking interview notes",
  description: "Read notes for one interview. Use after lookup_interviews when HR asks what was said or why a decision was made.",
  argsHint: '{"interviewId":"24-hex interview id"}',
  inputSchema,
  async execute(input) {
    const interviewId = asObjectId(input.interviewId);
    if (!interviewId) {
      return { interviewId: input.interviewId, notes: [], matchCount: 0 };
    }

    const rows = await readDb.find(
      READ_COLLECTIONS.interviewNotes,
      { interviewId: { $in: [interviewId, input.interviewId] } },
      { sort: { createdAt: 1 }, limit: 50, projection: { authorName: 1, authorEmail: 1, content: 1, createdAt: 1 } },
    );

    const notes = rows.map((row) => ({
      id: idString(row._id),
      authorName: String(row.authorName ?? ""),
      authorEmail: String(row.authorEmail ?? ""),
      content: String(row.content ?? ""),
      createdAt: isoDate(row.createdAt),
    }));

    return { interviewId: input.interviewId, matchCount: notes.length, notes };
  },
});
