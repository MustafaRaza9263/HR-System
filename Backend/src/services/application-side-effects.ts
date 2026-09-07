import { notifyHR } from "../notifications/index.js";
import { logger } from "../utils/logger.js";
import { enqueueScoring } from "./application-scoring/queue.js";
import { sendSubmissionConfirmed } from "./email/index.js";

export function enqueueApplicationSideEffects(input: {
  applicationId: string;
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
}) {
  setImmediate(() => {
    sendSubmissionConfirmed({
      to: input.candidateEmail,
      candidateName: input.candidateName,
      jobTitle: input.jobTitle,
    });
    void notifyHR("new_application", input.applicationId).catch((error) => {
      logger.error("notifyHR failed", error);
    });
    enqueueScoring(input.applicationId);
  });
}
