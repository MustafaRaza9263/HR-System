import { logger } from "../utils/logger.js";

export interface EmailPayload {
  to: string;
  template: string;
  data: Record<string, unknown>;
}

/**
 * Transport is stubbed. Swap `sendEmail` for SES/SendGrid later — callers stay the same.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ status: "stubbed" }> {
  logger.info(`email  ${payload.template} → ${payload.to}`);
  return { status: "stubbed" };
}

export async function sendEmailBestEffort(payload: EmailPayload): Promise<void> {
  try {
    await sendEmail(payload);
  } catch (error) {
    logger.error(`email failed  ${payload.template} → ${payload.to}`, error);
  }
}

export function sendCandidateInterviewScheduled(input: {
  to: string;
  candidateName: string;
  jobTitle: string;
  label: string;
  date: string;
  time: string;
  durationMinutes: number;
}) {
  return sendEmailBestEffort({ to: input.to, template: "interview-scheduled", data: input });
}

export function sendCandidateInterviewRescheduled(input: {
  to: string;
  candidateName: string;
  jobTitle: string;
  label: string;
  date: string;
  time: string;
  durationMinutes: number;
}) {
  return sendEmailBestEffort({ to: input.to, template: "interview-rescheduled", data: input });
}

export function sendCandidateInterviewCancelled(input: {
  to: string;
  candidateName: string;
  jobTitle: string;
  date: string;
  time: string;
}) {
  return sendEmailBestEffort({ to: input.to, template: "interview-cancelled", data: input });
}

export function sendAccessApprovedEmail(input: { to: string; name: string; accessUrl: string; departmentName: string }) {
  return sendEmailBestEffort({ to: input.to, template: "access-link-approved", data: input });
}

export function sendAccessRejectedEmail(input: { to: string; name: string; departmentName: string }) {
  return sendEmailBestEffort({ to: input.to, template: "access-link-rejected", data: input });
}

export function sendAccessInviteEmail(input: { to: string; accessUrl: string; departmentName: string }) {
  return sendEmailBestEffort({ to: input.to, template: "access-link-invite", data: input });
}
