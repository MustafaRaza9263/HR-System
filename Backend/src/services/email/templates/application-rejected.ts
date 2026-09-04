import { escapeHtml } from "../format.js";
import type { ApplicationRejectedData, EmailTemplate } from "../types.js";

export const applicationRejectedTemplate: EmailTemplate<ApplicationRejectedData> = {
  id: "application-rejected",
  subject: (data) => `Update on your application for ${data.jobTitle}`,
  heading: () => "Update on your application",
  preview: (data) => `An update on your application for ${data.jobTitle}.`,
  htmlBody: (data) => `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(data.candidateName)},</p>
    <p style="margin:0 0 12px;">Thank you for your interest in <strong>${escapeHtml(data.jobTitle)}</strong>. After review, we will not be moving forward with your application at this time.</p>
    <p style="margin:16px 0 0;">We appreciate the time you spent applying and wish you the best in your search.</p>
  `,
  textBody: (data) =>
    [
      `Hi ${data.candidateName},`,
      "",
      `Thank you for your interest in ${data.jobTitle}. After review, we will not be moving forward with your application at this time.`,
      "",
      "We appreciate the time you spent applying and wish you the best in your search.",
    ].join("\n"),
};
