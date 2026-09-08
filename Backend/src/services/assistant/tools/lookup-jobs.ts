import { z } from "zod";

import { escapeRegex } from "../../../utils/application-filter.js";
import { asObjectId, idString, isoDate } from "../ids.js";
import { READ_COLLECTIONS, readDb } from "../read.js";
import { registerTool } from "./registry.js";

const LIMIT = 12;

const inputSchema = z.object({
  q: z.string().trim().max(120).optional(),
  jobId: z.string().trim().max(24).optional(),
  departmentId: z.string().trim().max(24).optional(),
  roleId: z.string().trim().max(24).optional(),
  status: z.enum(["draft", "open", "closed"]).optional(),
});

registerTool({
  name: "lookup_jobs",
  family: "data",
  label: "Checking jobs",
  description: "Find jobs by title, id, department, role, or status (draft/open/closed). Does not return the rich-text description body.",
  argsHint:
    '{"q":"optional title/id","jobId":"optional 24-hex","departmentId":"optional","roleId":"optional","status":"draft|open|closed"}',
  inputSchema,
  async execute(input) {
    const filter: Record<string, unknown> = {};
    const jobId = asObjectId(input.jobId);
    const departmentId = asObjectId(input.departmentId);
    const roleId = asObjectId(input.roleId);
    if (jobId) filter._id = jobId;
    if (departmentId) filter.departmentId = departmentId;
    if (roleId) filter.roleId = roleId;
    if (input.status) filter.status = input.status;
    if (input.q) {
      const rx = { $regex: escapeRegex(input.q), $options: "i" };
      const or: object[] = [{ title: rx }, { descriptionPlain: rx }];
      const qId = asObjectId(input.q);
      if (qId) or.push({ _id: qId });
      filter.$or = or;
    }

    const rows = await readDb.find(READ_COLLECTIONS.jobs, filter, {
      projection: {
        title: 1,
        status: 1,
        jobType: 1,
        slug: 1,
        salaryMin: 1,
        salaryMax: 1,
        salaryCurrency: 1,
        applicationCount: 1,
        closeReason: 1,
        publishedAt: 1,
        closedAt: 1,
        createdAt: 1,
        departmentId: 1,
        roleId: 1,
      },
      sort: { createdAt: -1 },
      limit: LIMIT,
    });

    return {
      matchCount: rows.length,
      cappedAt: LIMIT,
      jobs: rows.map((row) => ({
        id: idString(row._id),
        title: String(row.title ?? ""),
        status: String(row.status ?? ""),
        jobType: row.jobType ?? null,
        slug: row.slug ?? null,
        departmentId: idString(row.departmentId),
        roleId: idString(row.roleId),
        salaryMin: row.salaryMin ?? null,
        salaryMax: row.salaryMax ?? null,
        salaryCurrency: row.salaryCurrency ?? null,
        applicationCount: row.applicationCount ?? 0,
        closeReason: row.closeReason ?? null,
        publishedAt: isoDate(row.publishedAt),
        closedAt: isoDate(row.closedAt),
        createdAt: isoDate(row.createdAt),
      })),
    };
  },
});
