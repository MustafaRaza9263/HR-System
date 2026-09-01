import { Types } from "mongoose";

import { Application } from "../models/application.model.js";
import { Interview } from "../models/interview.model.js";

const LOCKED_STATUSES = new Set(["rejected", "approved", "trial"]);

export async function recomputeApplicationStatus(applicationId: Types.ObjectId | string): Promise<void> {
  const application = await Application.findById(applicationId).select("status").lean();
  if (!application || LOCKED_STATUSES.has(application.status)) return;

  const interviews = await Interview.find({ applicationId })
    .select("status")
    .lean();

  const hasScheduled = interviews.some((item) => item.status === "scheduled");
  const hasCompleted = interviews.some((item) => item.status === "completed");

  const nextStatus = hasScheduled
    ? "interview_scheduled"
    : hasCompleted
      ? "interviewed"
      : "under_review";

  if (application.status === nextStatus) return;

  await Application.updateOne({ _id: application._id }, { $set: { status: nextStatus } }).exec();
}
