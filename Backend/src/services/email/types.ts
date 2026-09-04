export const EMAIL_TEMPLATE_IDS = [
  "submission-confirmed",
  "application-approved",
  "application-rejected",
  "access-invite",
  "interview-scheduled",
  "interview-rescheduled",
  "access-approved",
  "access-rejected",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export interface EmailJob {
  to: string;
  template: EmailTemplateId;
  data: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface RenderedEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: EmailTemplateId;
  idempotencyKey?: string;
}

export interface EmailTemplate<T extends Record<string, unknown>> {
  id: EmailTemplateId;
  subject: (data: T) => string;
  heading: (data: T) => string;
  preview: (data: T) => string;
  htmlBody: (data: T) => string;
  textBody: (data: T) => string;
}

export interface SubmissionConfirmedData extends Record<string, unknown> {
  candidateName: string;
  jobTitle: string;
}

export interface ApplicationDecisionData extends Record<string, unknown> {
  candidateName: string;
  jobTitle: string;
}

export type ApplicationRejectedData = ApplicationDecisionData;

export interface ApplicationApprovedData extends ApplicationDecisionData {
  reason: string;
}

export interface InterviewEmailData extends Record<string, unknown> {
  candidateName: string;
  jobTitle: string;
  label: string;
  date: string;
  time: string;
  durationMinutes: number;
}

export interface AccessInviteData extends Record<string, unknown> {
  accessUrl: string;
  departmentName: string;
}

export interface AccessApprovedData extends Record<string, unknown> {
  name: string;
  accessUrl: string;
  departmentName: string;
}

export interface AccessRejectedData extends Record<string, unknown> {
  name: string;
  departmentName: string;
}
