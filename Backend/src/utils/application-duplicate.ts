import type { Types } from "mongoose";

import { Application } from "../models/application.model.js";
import { ApiError } from "./api-error.js";

export async function assertNoDuplicateApplication(input: {
  jobId: Types.ObjectId | string;
  candidateEmail: string;
  candidateCnic: string;
}) {
  const exists = await Application.exists({
    jobId: input.jobId,
    status: { $ne: "rejected" },
    $or: [
      { candidateEmail: input.candidateEmail.toLowerCase() },
      { candidateCnic: input.candidateCnic },
    ],
  });
  if (exists) {
    throw new ApiError(
      409,
      "DUPLICATE_APPLICATION",
      "You already have an application for this role.",
    );
  }
}
