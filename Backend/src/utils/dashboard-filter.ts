import { Types } from "mongoose";

import { Job } from "../models/job.model.js";
import { assertObjectId } from "./object-id.js";

export type DashboardJobFilter = string;

export function parseDashboardJobFilter(raw: string | undefined): DashboardJobFilter {
  if (!raw || raw === "all") return "all";
  if (raw === "open" || raw === "compare") return raw;
  assertObjectId(raw, "JOB_NOT_FOUND", "Job was not found.");
  return raw;
}

export async function applicationJobMatch(job: DashboardJobFilter): Promise<Record<string, unknown>> {
  if (job === "all") return {};
  if (job === "open" || job === "compare") {
    const jobs = await Job.find({ status: "open" }).select("_id").lean();
    return { jobId: { $in: jobs.map((item) => item._id) } };
  }
  return { jobId: new Types.ObjectId(job) };
}
