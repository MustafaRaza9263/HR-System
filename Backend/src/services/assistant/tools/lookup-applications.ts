import { z } from "zod";

import { escapeRegex } from "../../../utils/application-filter.js";
import { asObjectId, idString, isoDate } from "../ids.js";
import { READ_COLLECTIONS, readDb } from "../read.js";
import { registerTool } from "./registry.js";

const MATCH_LIMIT = 8;

const inputSchema = z.object({
  q: z.string().trim().max(120).optional(),
  applicationId: z.string().trim().max(24).optional(),
  jobId: z.string().trim().max(24).optional(),
  roleId: z.string().trim().max(24).optional(),
  status: z
    .enum([
      "submitted",
      "under_review",
      "interview_scheduled",
      "interviewed",
      "approved",
      "rejected",
      "trial",
    ])
    .optional(),
  scoreMin: z.number().min(0).max(10).optional(),
  scoreMax: z.number().min(0).max(10).optional(),
});

type ApplicationRow = {
  _id: unknown;
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateCnic?: string | null;
  candidateDateOfBirth?: string | null;
  status?: string;
  createdAt?: Date;
  rejectionReason?: string | null;
  decisionReason?: string | null;
  jobId?: unknown;
  roleSnapshot?: {
    title?: string;
    departmentName?: string;
    roleName?: string;
  };
  scoring?: {
    status?: string | null;
    score?: number | null;
    summary?: string | null;
  } | null;
  statusHistory?: Array<{ status?: string; at?: Date }>;
};

const listProjection = {
  candidateName: 1,
  candidateEmail: 1,
  candidatePhone: 1,
  candidateCnic: 1,
  candidateDateOfBirth: 1,
  status: 1,
  createdAt: 1,
  rejectionReason: 1,
  decisionReason: 1,
  jobId: 1,
  "roleSnapshot.title": 1,
  "roleSnapshot.departmentName": 1,
  "roleSnapshot.roleName": 1,
  "scoring.status": 1,
  "scoring.score": 1,
  "scoring.summary": 1,
  statusHistory: 1,
} as const;

function serializeMatch(row: ApplicationRow) {
  return {
    id: idString(row._id),
    name: row.candidateName ?? "",
    email: row.candidateEmail ?? "",
    phone: row.candidatePhone ?? "",
    cnic: row.candidateCnic ?? null,
    dateOfBirth: row.candidateDateOfBirth ?? null,
    jobTitle: row.roleSnapshot?.title ?? "",
    departmentName: row.roleSnapshot?.departmentName ?? "",
    roleName: row.roleSnapshot?.roleName ?? "",
    appliedAt: isoDate(row.createdAt),
    status: row.status ?? "",
    rejectionReason: row.rejectionReason ?? null,
    decisionReason: row.decisionReason ?? null,
    score: typeof row.scoring?.score === "number" ? row.scoring.score : null,
    scoringStatus: row.scoring?.status ?? null,
    scoringSummary: row.scoring?.summary ?? null,
    statusHistory: (row.statusHistory ?? []).map((entry) => ({
      status: entry.status ?? "",
      at: isoDate(entry.at),
    })),
  };
}

registerTool({
  name: "lookup_applications",
  family: "data",
  label: "Checking applications",
  description:
    "Find applications/candidates. Name search always returns a capped list with enough detail to tell people apart. Never guess when several people match.",
  argsHint:
    '{"q":"optional name/email/phone/cnic","applicationId":"optional 24-hex","jobId":"optional","roleId":"optional","status":"optional enum","scoreMin":0,"scoreMax":10}',
  inputSchema,
  async execute(input) {
    const filter: Record<string, unknown> = {};
    const applicationId = asObjectId(input.applicationId);
    const jobId = asObjectId(input.jobId);
    const roleId = asObjectId(input.roleId);
    if (applicationId) filter._id = applicationId;
    if (jobId) filter.jobId = jobId;
    if (roleId) filter["roleSnapshot.roleId"] = roleId;
    if (input.status) filter.status = input.status;

    const score: Record<string, number> = {};
    if (typeof input.scoreMin === "number") score.$gte = input.scoreMin;
    if (typeof input.scoreMax === "number") score.$lte = input.scoreMax;
    if (Object.keys(score).length > 0) filter["scoring.score"] = score;

    if (input.q) {
      const rx = { $regex: escapeRegex(input.q), $options: "i" };
      const or: object[] = [
        { candidateName: rx },
        { candidateEmail: rx },
        { candidatePhone: rx },
        { candidateCnic: rx },
      ];
      const qId = asObjectId(input.q);
      if (qId) or.push({ _id: qId });
      filter.$or = or;
    }

    const rows = (await readDb.find(READ_COLLECTIONS.applications, filter, {
      projection: listProjection,
      sort: { createdAt: -1 },
      limit: MATCH_LIMIT,
    })) as ApplicationRow[];

    const matches = rows.map(serializeMatch);
    return {
      matchCount: matches.length,
      cappedAt: MATCH_LIMIT,
      matches,
    };
  },
});
