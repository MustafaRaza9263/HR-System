import { wrapEmailHtml } from "../layout.js";
import type { EmailTemplate, EmailTemplateId, RenderedEmail } from "../types.js";
import { accessApprovedTemplate, accessRejectedTemplate } from "./access-decision.js";
import { accessInviteTemplate } from "./access-invite.js";
import { applicationApprovedTemplate } from "./application-approved.js";
import { applicationRejectedTemplate } from "./application-rejected.js";
import { interviewRescheduledTemplate, interviewScheduledTemplate } from "./interview.js";
import { submissionConfirmedTemplate } from "./submission-confirmed.js";

const templates: Record<EmailTemplateId, EmailTemplate<Record<string, unknown>>> = {
  "submission-confirmed": submissionConfirmedTemplate as EmailTemplate<Record<string, unknown>>,
  "application-approved": applicationApprovedTemplate as EmailTemplate<Record<string, unknown>>,
  "application-rejected": applicationRejectedTemplate as EmailTemplate<Record<string, unknown>>,
  "access-invite": accessInviteTemplate as EmailTemplate<Record<string, unknown>>,
  "interview-scheduled": interviewScheduledTemplate as EmailTemplate<Record<string, unknown>>,
  "interview-rescheduled": interviewRescheduledTemplate as EmailTemplate<Record<string, unknown>>,
  "access-approved": accessApprovedTemplate as EmailTemplate<Record<string, unknown>>,
  "access-rejected": accessRejectedTemplate as EmailTemplate<Record<string, unknown>>,
};

export function renderEmail(templateId: EmailTemplateId, to: string, data: Record<string, unknown>, idempotencyKey: string | undefined): RenderedEmail {
  const template = templates[templateId];
  return {
    to,
    template: templateId,
    subject: template.subject(data),
    html: wrapEmailHtml({
      heading: template.heading(data),
      preview: template.preview(data),
      body: template.htmlBody(data),
    }),
    text: template.textBody(data),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}
