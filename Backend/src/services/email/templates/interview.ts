import { escapeHtml, formatCalendarDate, formatClockTime, formatDuration } from "../format.js";
import type { EmailTemplate, InterviewEmailData } from "../types.js";

function detailsHtml(data: InterviewEmailData) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0;width:100%;border:1px solid #e5e7eb;border-radius:12px;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;">Interview details</p>
          <p style="margin:0 0 4px;"><strong>Role:</strong> ${escapeHtml(data.jobTitle)}</p>
          <p style="margin:0 0 4px;"><strong>Label:</strong> ${escapeHtml(data.label)}</p>
          <p style="margin:0 0 4px;"><strong>Date:</strong> ${escapeHtml(formatCalendarDate(data.date))}</p>
          <p style="margin:0 0 4px;"><strong>Time:</strong> ${escapeHtml(formatClockTime(data.time))}</p>
          <p style="margin:0;"><strong>Duration:</strong> ${escapeHtml(formatDuration(data.durationMinutes))}</p>
        </td>
      </tr>
    </table>
  `;
}

function detailsText(data: InterviewEmailData) {
  return [
    `Role: ${data.jobTitle}`,
    `Label: ${data.label}`,
    `Date: ${formatCalendarDate(data.date)}`,
    `Time: ${formatClockTime(data.time)}`,
    `Duration: ${formatDuration(data.durationMinutes)}`,
  ].join("\n");
}

export const interviewScheduledTemplate: EmailTemplate<InterviewEmailData> = {
  id: "interview-scheduled",
  subject: (data) => `Interview scheduled for ${data.jobTitle}`,
  heading: () => "Your interview is scheduled",
  preview: (data) => `An interview for ${data.jobTitle} has been scheduled.`,
  htmlBody: (data) => `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(data.candidateName)},</p>
    <p style="margin:0 0 12px;">An interview has been scheduled for your application to <strong>${escapeHtml(data.jobTitle)}</strong>.</p>
    ${detailsHtml(data)}
    <p style="margin:16px 0 0;">If you cannot attend, please reply to the hiring team as soon as you can.</p>
  `,
  textBody: (data) =>
    [
      `Hi ${data.candidateName},`,
      "",
      `An interview has been scheduled for your application to ${data.jobTitle}.`,
      "",
      detailsText(data),
      "",
      "If you cannot attend, please reply to the hiring team as soon as you can.",
    ].join("\n"),
};

export const interviewRescheduledTemplate: EmailTemplate<InterviewEmailData> = {
  id: "interview-rescheduled",
  subject: (data) => `Interview rescheduled for ${data.jobTitle}`,
  heading: () => "Your interview was rescheduled",
  preview: (data) => `Your interview for ${data.jobTitle} has a new time.`,
  htmlBody: (data) => `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(data.candidateName)},</p>
    <p style="margin:0 0 12px;">Your interview for <strong>${escapeHtml(data.jobTitle)}</strong> has been rescheduled. Please use the updated details below.</p>
    ${detailsHtml(data)}
    <p style="margin:16px 0 0;">If you cannot attend the new time, please reply to the hiring team as soon as you can.</p>
  `,
  textBody: (data) =>
    [
      `Hi ${data.candidateName},`,
      "",
      `Your interview for ${data.jobTitle} has been rescheduled. Please use the updated details below.`,
      "",
      detailsText(data),
      "",
      "If you cannot attend the new time, please reply to the hiring team as soon as you can.",
    ].join("\n"),
};
