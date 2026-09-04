import { escapeHtml } from "../format.js";
import { primaryButton } from "../layout.js";
import type { AccessInviteData, EmailTemplate } from "../types.js";

export const accessInviteTemplate: EmailTemplate<AccessInviteData> = {
  id: "access-invite",
  subject: (data) => `Interview access for ${data.departmentName}`,
  heading: () => "You are invited to interview",
  preview: (data) => `Use this link to request access for ${data.departmentName} interviews today.`,
  htmlBody: (data) => `
    <p style="margin:0 0 12px;">You have been invited to join interviews for <strong>${escapeHtml(data.departmentName)}</strong>.</p>
    <p style="margin:0 0 12px;">Open the link below, register with your name and email, and wait for HR to approve your access. This link is valid for today only.</p>
    ${primaryButton(data.accessUrl, "Open interview access")}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;word-break:break-all;">${escapeHtml(data.accessUrl)}</p>
  `,
  textBody: (data) =>
    [
      `You have been invited to join interviews for ${data.departmentName}.`,
      "",
      "Open the link below, register with your name and email, and wait for HR to approve your access. This link is valid for today only.",
      "",
      data.accessUrl,
    ].join("\n"),
};
