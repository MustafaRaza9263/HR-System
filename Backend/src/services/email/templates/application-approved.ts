import { escapeHtml, htmlParagraphs } from "../format.js";
import type { ApplicationApprovedData, EmailTemplate } from "../types.js";

export const applicationApprovedTemplate: EmailTemplate<ApplicationApprovedData> = {
  id: "application-approved",
  subject: (data) => `Update on your application for ${data.jobTitle}`,
  heading: () => "Your application was approved",
  preview: (data) => `Good news — your application for ${data.jobTitle} was approved.`,
  htmlBody: (data) => `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(data.candidateName)},</p>
    <p style="margin:0 0 12px;">We are pleased to let you know that your application for <strong>${escapeHtml(data.jobTitle)}</strong> has been approved.</p>
    <p style="margin:16px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;">Note from the hiring team</p>
    <div style="margin:0;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
      ${htmlParagraphs(data.reason)}
    </div>
    <p style="margin:16px 0 0;">We will follow up with next steps shortly.</p>
  `,
  textBody: (data) =>
    [
      `Hi ${data.candidateName},`,
      "",
      `We are pleased to let you know that your application for ${data.jobTitle} has been approved.`,
      "",
      "Note from the hiring team:",
      data.reason,
      "",
      "We will follow up with next steps shortly.",
    ].join("\n"),
};
