import { env } from "../../config/env.js";
import { enqueueEmail, enqueueEmails } from "./queue.js";
import { isEmailConfigured } from "./transport.js";
import type {
  AccessApprovedData,
  AccessInviteData,
  AccessRejectedData,
  ApplicationApprovedData,
  ApplicationRejectedData,
  EmailJob,
  InterviewEmailData,
  SubmissionConfirmedData,
} from "./types.js";

export type { EmailJob, EmailTemplateId } from "./types.js";
export { drainEmailQueue } from "./queue.js";
export { isEmailConfigured } from "./transport.js";

export function sendEmailBestEffort(job: EmailJob) {
  enqueueEmail(job);
}

export function sendEmailsBestEffort(jobs: EmailJob[]) {
  enqueueEmails(jobs);
}

export function sendSubmissionConfirmed(input: { to: string } & SubmissionConfirmedData) {
  enqueueEmail({
    to: input.to,
    template: "submission-confirmed",
    data: { candidateName: input.candidateName, jobTitle: input.jobTitle },
    idempotencyKey: `submission-confirmed/${input.to}/${input.jobTitle}`.slice(0, 256),
  });
}

export function sendCandidateInterviewScheduled(input: { to: string } & InterviewEmailData) {
  enqueueEmail({
    to: input.to,
    template: "interview-scheduled",
    data: input,
  });
}

export function sendCandidateInterviewRescheduled(input: { to: string } & InterviewEmailData) {
  enqueueEmail({
    to: input.to,
    template: "interview-rescheduled",
    data: input,
  });
}

export function sendCandidateApplicationApproved(input: { to: string } & ApplicationApprovedData) {
  enqueueEmail({
    to: input.to,
    template: "application-approved",
    data: { candidateName: input.candidateName, jobTitle: input.jobTitle, reason: input.reason },
  });
}

export function sendCandidateApplicationRejected(
  input: { to: string; idempotencyKey?: string } & ApplicationRejectedData,
) {
  enqueueEmail({
    to: input.to,
    template: "application-rejected",
    data: { candidateName: input.candidateName, jobTitle: input.jobTitle },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export function sendAccessInviteEmail(input: { to: string } & AccessInviteData) {
  enqueueEmail({
    to: input.to,
    template: "access-invite",
    data: { accessUrl: input.accessUrl, departmentName: input.departmentName },
  });
}

export function sendAccessApprovedEmail(input: { to: string } & AccessApprovedData) {
  enqueueEmail({
    to: input.to,
    template: "access-approved",
    data: { name: input.name, accessUrl: input.accessUrl, departmentName: input.departmentName },
  });
}

export function sendAccessRejectedEmail(input: { to: string } & AccessRejectedData) {
  enqueueEmail({
    to: input.to,
    template: "access-rejected",
    data: { name: input.name, departmentName: input.departmentName },
  });
}

export function emailStatusLine() {
  return isEmailConfigured() ? `email via Resend (${env.EMAIL_FROM})` : "email stub (RESEND_API_KEY unset)";
}
