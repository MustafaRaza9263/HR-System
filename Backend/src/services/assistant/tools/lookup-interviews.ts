import { z } from "zod";

import { escapeRegex } from "../../../utils/application-filter.js";
import { getDisplayStatus } from "../../../utils/interview-rules.js";
import { shiftCalendarDate, todayCalendarDate } from "../../../utils/date-state.js";
import { asObjectId, idString } from "../ids.js";
import { READ_COLLECTIONS, readDb } from "../read.js";
import { registerTool } from "./registry.js";

const LIMIT = 15;

const inputSchema = z.object({
  q: z.string().trim().max(120).optional(),
  applicationId: z.string().trim().max(24).optional(),
  interviewId: z.string().trim().max(24).optional(),
  jobId: z.string().trim().max(24).optional(),
  roleId: z.string().trim().max(24).optional(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show", "overdue"]).optional(),
  bucket: z.enum(["scheduled", "today", "tomorrow", "overdue"]).optional(),
});

type InterviewRow = {
  _id: unknown;
  applicationId?: unknown;
  label?: string;
  date?: string;
  time?: string;
  durationMinutes?: number;
  status?: string;
  application?: {
    candidateName?: string;
    candidateEmail?: string;
    candidatePhone?: string;
    jobId?: unknown;
    roleSnapshot?: { title?: string; departmentName?: string; roleId?: unknown };
  };
};

function interviewMatch(input: z.infer<typeof inputSchema>, today: string, tomorrow: string) {
  const parts: Record<string, unknown>[] = [];
  const interviewId = asObjectId(input.interviewId);
  const applicationId = asObjectId(input.applicationId);
  if (interviewId) parts.push({ _id: interviewId });
  if (applicationId) parts.push({ applicationId });

  if (input.status === "overdue") {
    parts.push({ status: "scheduled", date: { $lt: today } });
  } else if (input.status) {
    parts.push({ status: input.status });
  }

  if (input.bucket === "scheduled") parts.push({ status: "scheduled" });
  if (input.bucket === "today") parts.push({ status: "scheduled", date: today });
  if (input.bucket === "tomorrow") parts.push({ status: "scheduled", date: tomorrow });
  if (input.bucket === "overdue") parts.push({ status: "scheduled", date: { $lt: today } });

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0]!;
  return { $and: parts };
}

registerTool({
  name: "lookup_interviews",
  family: "data",
  label: "Checking interviews",
  description:
    "List interviews by application, filters, or buckets (scheduled / today / tomorrow / overdue). Overdue means stored status scheduled and date before today (Asia/Karachi).",
  argsHint:
    '{"q":"optional candidate/job/label","applicationId":"optional","interviewId":"optional","jobId":"optional","roleId":"optional","status":"scheduled|completed|cancelled|no_show|overdue","bucket":"scheduled|today|tomorrow|overdue"}',
  inputSchema,
  async execute(input) {
    const today = todayCalendarDate();
    const tomorrow = shiftCalendarDate(today, 1);
    const match = interviewMatch(input, today, tomorrow);
    const jobId = asObjectId(input.jobId);
    const roleId = asObjectId(input.roleId);
    const applicationParts: Record<string, unknown>[] = [];
    if (jobId) applicationParts.push({ "application.jobId": jobId });
    if (roleId) applicationParts.push({ "application.roleSnapshot.roleId": roleId });
    if (input.q) {
      const rx = { $regex: escapeRegex(input.q), $options: "i" };
      applicationParts.push({
        $or: [
          { label: rx },
          { "application.candidateName": rx },
          { "application.candidateEmail": rx },
          { "application.candidatePhone": rx },
          { "application.roleSnapshot.title": rx },
        ],
      });
    }

    const pipeline: object[] = [
      { $match: match },
      {
        $lookup: {
          from: READ_COLLECTIONS.applications,
          localField: "applicationId",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                candidateName: 1,
                candidateEmail: 1,
                candidatePhone: 1,
                jobId: 1,
                "roleSnapshot.title": 1,
                "roleSnapshot.departmentName": 1,
                "roleSnapshot.roleId": 1,
              },
            },
          ],
          as: "application",
        },
      },
      { $unwind: { path: "$application", preserveNullAndEmptyArrays: true } },
    ];
    if (applicationParts.length === 1) pipeline.push({ $match: applicationParts[0]! });
    else if (applicationParts.length > 1) pipeline.push({ $match: { $and: applicationParts } });
    pipeline.push({ $sort: { date: -1, time: -1, _id: -1 } }, { $limit: LIMIT });

    const rows = (await readDb.aggregate(READ_COLLECTIONS.interviews, pipeline)) as InterviewRow[];
    return {
      matchCount: rows.length,
      cappedAt: LIMIT,
      interviews: rows.map((row) => {
        const status = row.status ?? "scheduled";
        const date = row.date ?? "";
        return {
          id: idString(row._id),
          applicationId: idString(row.applicationId),
          label: row.label ?? "",
          date,
          time: row.time ?? "",
          durationMinutes: row.durationMinutes ?? null,
          status,
          displayStatus: getDisplayStatus({ status, date }),
          candidateName: row.application?.candidateName ?? "",
          candidateEmail: row.application?.candidateEmail ?? "",
          candidatePhone: row.application?.candidatePhone ?? "",
          jobTitle: row.application?.roleSnapshot?.title ?? "",
          departmentName: row.application?.roleSnapshot?.departmentName ?? "",
        };
      }),
    };
  },
});
