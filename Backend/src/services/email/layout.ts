import { escapeHtml } from "./format.js";

const BRAND = "HR System";

export function wrapEmailHtml(input: { heading: string; preview: string; body: string }) {
  const heading = escapeHtml(input.heading);
  const preview = escapeHtml(input.preview);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${BRAND}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:20px 28px;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                ${BRAND}
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827;">${heading}</h1>
                ${input.body}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">
            This message was sent by ${BRAND}. Please do not reply to this email.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function primaryButton(href: string, label: string) {
  return `<p style="margin:24px 0 0;">
  <a href="${escapeHtml(href)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:10px;">${escapeHtml(label)}</a>
</p>`;
}
