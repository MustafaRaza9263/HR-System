import type { Types } from "mongoose";

import { Application } from "../models/application.model.js";
import { Interview } from "../models/interview.model.js";

const LOCKED_STATUSES = new Set(["rejected", "approved"]);
const PIPELINE_STATUSES = new Set(["under_review", "interview_scheduled", "interviewed"]);

export type ApplicationStatusValue =
  | "submitted"
  | "under_review"
  | "interview_scheduled"
  | "interviewed"
  | "approved"
  | "rejected"
  | "trial";

export interface StatusHistoryEntry {
  status: ApplicationStatusValue;
  at: Date;
}

export interface StatusHistorySource {
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  rejectedAt?: Date | null;
  approvedAt?: Date | null;
  trialAt?: Date | null;
}

export function applicationStatusUpdate(
  status: ApplicationStatusValue,
  at: Date,
  extra: Record<string, unknown> = {},
) {
  return {
    $set: { status, ...extra },
    $push: { statusHistory: { status, at } },
  };
}

export function reconstructStatusHistory(doc: StatusHistorySource): StatusHistoryEntry[] {
  const submittedAt = doc.createdAt;
  const history: StatusHistoryEntry[] = [{ status: "submitted", at: submittedAt }];
  if (doc.status === "submitted") return history;

  const dated: StatusHistoryEntry[] = [];
  if (doc.trialAt) dated.push({ status: "trial", at: doc.trialAt });
  if (doc.approvedAt) dated.push({ status: "approved", at: doc.approvedAt });
  if (doc.rejectedAt) dated.push({ status: "rejected", at: doc.rejectedAt });
  dated.sort((a, b) => a.at.getTime() - b.at.getTime());

  if (PIPELINE_STATUSES.has(doc.status)) {
    for (const event of dated) {
      if (event.at.getTime() >= submittedAt.getTime() && event.at.getTime() <= (doc.updatedAt ?? submittedAt).getTime()) {
        history.push(event);
      }
    }
    const last = history[history.length - 1];
    if (last?.status !== doc.status) {
      history.push({ status: doc.status as ApplicationStatusValue, at: doc.updatedAt ?? submittedAt });
    }
    return history;
  }

  for (const event of dated) {
    if (event.at.getTime() >= submittedAt.getTime()) history.push(event);
  }
  const last = history[history.length - 1];
  if (last?.status !== doc.status) {
    history.push({ status: doc.status as ApplicationStatusValue, at: doc.updatedAt ?? submittedAt });
  }
  return history;
}

export async function migrateApplicationStatusHistory(): Promise<void> {
  const docs = await Application.find({
    $or: [{ statusHistory: { $exists: false } }, { statusHistory: { $size: 0 } }],
  })
    .select("status createdAt updatedAt rejectedAt approvedAt trialAt")
    .lean();

  if (docs.length === 0) return;

  await Application.collection.bulkWrite(
    docs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { statusHistory: reconstructStatusHistory(doc) } },
      },
    })),
  );
}

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

  await Application.updateOne(
    { _id: application._id },
    applicationStatusUpdate(nextStatus, new Date()),
  ).exec();
}
