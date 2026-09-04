import { escapeHtml } from "../format.js";
import { primaryButton } from "../layout.js";
import type { AccessApprovedData, AccessRejectedData, EmailTemplate } from "../types.js";

export const accessApprovedTemplate: EmailTemplate<AccessApprovedData> = {
  id: "access-approved",
  subject: (data) => `Access approved for ${data.departmentName} interviews`,
  heading: () => "Your interview access was approved",
  preview: (data) => `You can now join ${data.departmentName} interviews.`,
  htmlBody: (data) => `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(data.name)},</p>
    <p style="margin:0 0 12px;">Your request to join <strong>${escapeHtml(data.departmentName)}</strong> interviews has been approved. Use the link below to open today's interviewer portal.</p>
    ${primaryButton(data.accessUrl, "Open interviewer portal")}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;word-break:break-all;">${escapeHtml(data.accessUrl)}</p>
  `,
  textBody: (data) =>
    [
      `Hi ${data.name},`,
      "",
      `Your request to join ${data.departmentName} interviews has been approved.`,
      "",
      data.accessUrl,
    ].join("\n"),
};

export const accessRejectedTemplate: EmailTemplate<AccessRejectedData> = {
  id: "access-rejected",
  subject: (data) => `Access update for ${data.departmentName} interviews`,
  heading: () => "Interview access was not approved",
  preview: (data) => `Your request for ${data.departmentName} interview access was not approved.`,
  htmlBody: (data) => `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(data.name)},</p>
    <p style="margin:0 0 12px;">Your request to join <strong>${escapeHtml(data.departmentName)}</strong> interviews was not approved. You will not be able to use this access link.</p>
  `,
  textBody: (data) =>
    [
      `Hi ${data.name},`,
      "",
      `Your request to join ${data.departmentName} interviews was not approved. You will not be able to use this access link.`,
    ].join("\n"),
};
