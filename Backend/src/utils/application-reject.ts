import { Types } from "mongoose";

import { Application } from "../models/application.model.js";
import { Interview } from "../models/interview.model.js";
import { sendCandidateApplicationApproved, sendCandidateApplicationTrial, sendEmailBestEffort } from "../services/email.js";
import { TERMINAL_APPLICATION_STATUSES } from "../schemas/application.schema.js";
import { ApiError } from "./api-error.js";

export async function cancelScheduledInterviews(applicationIds: Array<Types.ObjectId | string>) {
  if (applicationIds.length === 0) return;
  await Interview.updateMany(
    { applicationId: { $in: applicationIds }, status: "scheduled" },
    { $set: { status: "cancelled" } },
  ).exec();
}

export async function rejectApplications(
  applications: Array<{
    _id: Types.ObjectId;
    candidateEmail: string;
    candidateName: string;
    roleSnapshot: { title: string };
  }>,
  reason: string,
) {
  const now = new Date();
  const ids = applications.map((item) => item._id);
  if (ids.length === 0) return;

  await Application.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        status: "rejected",
        rejectionReason: reason.replace(/\s+/g, " ").trim(),
        rejectedAt: now,
      },
    },
  ).exec();

  await cancelScheduledInterviews(ids);

  for (const application of applications) {
    await sendEmailBestEffort({
      to: application.candidateEmail,
      template: "application-rejected",
      data: {
        candidateName: application.candidateName,
        jobTitle: application.roleSnapshot.title,
        reason,
      },
    });
  }
}

export function assertRejectable(status: string) {
  if ((TERMINAL_APPLICATION_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError(409, "APPLICATION_ALREADY_TERMINAL", "This application has already been closed.");
  }
}

export async function approveApplication(
  application: {
    _id: Types.ObjectId;
    candidateEmail: string;
    candidateName: string;
    roleSnapshot: { title: string };
  },
  reason: string,
) {
  const clean = reason.replace(/\s+/g, " ").trim();
  await Application.updateOne(
    { _id: application._id },
    {
      $set: {
        status: "approved",
        decisionReason: clean,
        approvedAt: new Date(),
      },
    },
  ).exec();

  await sendCandidateApplicationApproved({
    to: application.candidateEmail,
    candidateName: application.candidateName,
    jobTitle: application.roleSnapshot.title,
    reason: clean,
  });
}

export async function markApplicationTrial(application: {
  _id: Types.ObjectId;
  candidateEmail: string;
  candidateName: string;
  roleSnapshot: { title: string };
}) {
  await Application.updateOne(
    { _id: application._id },
    {
      $set: {
        status: "trial",
        trialAt: new Date(),
      },
    },
  ).exec();

  await sendCandidateApplicationTrial({
    to: application.candidateEmail,
    candidateName: application.candidateName,
    jobTitle: application.roleSnapshot.title,
  });
}
