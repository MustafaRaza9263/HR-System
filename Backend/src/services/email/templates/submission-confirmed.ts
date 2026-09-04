import { escapeHtml } from "../format.js";
import type { EmailTemplate, SubmissionConfirmedData } from "../types.js";

export const submissionConfirmedTemplate: EmailTemplate<SubmissionConfirmedData> = {
  id: "submission-confirmed",
  subject: (data) => `We received your application for ${data.jobTitle}`,
  heading: () => "Application received",
  preview: (data) => `We have received your application for ${data.jobTitle}.`,
  htmlBody: (data) => `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(data.candidateName)},</p>
    <p style="margin:0 0 12px;">Thank you for applying for <strong>${escapeHtml(data.jobTitle)}</strong>. We have received your application and our team will review it shortly.</p>
    <p style="margin:0;">You do not need to take any further action right now. We will email you if there is an update.</p>
  `,
  textBody: (data) =>
    [
      `Hi ${data.candidateName},`,
      "",
      `Thank you for applying for ${data.jobTitle}. We have received your application and our team will review it shortly.`,
      "",
      "You do not need to take any further action right now. We will email you if there is an update.",
    ].join("\n"),
};
