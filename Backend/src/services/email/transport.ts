import { Resend } from "resend";

import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import type { RenderedEmail } from "./types.js";

const BATCH_LIMIT = 100;

let client: Resend | null = null;

function resendClient() {
  if (!env.RESEND_API_KEY) return null;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

export function isEmailConfigured() {
  return Boolean(env.RESEND_API_KEY);
}

function toPayload(email: RenderedEmail) {
  return {
    from: env.EMAIL_FROM,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    tags: [{ name: "template", value: email.template }],
  };
}

function isRetryable(error: { name?: string; statusCode?: number | null } | null) {
  if (!error) return false;
  if (error.name === "rate_limit_exceeded") return true;
  return error.statusCode === 429 || error.statusCode === 500 || error.statusCode === 502 || error.statusCode === 503;
}

export async function deliverEmails(emails: RenderedEmail[]): Promise<{ retryable: boolean; message?: string }> {
  if (emails.length === 0) return { retryable: false };
  const resend = resendClient();
  if (!resend) {
    for (const email of emails) {
      logger.info(`email stub  ${email.template} → ${email.to}`);
    }
    return { retryable: false };
  }

  try {
    if (emails.length === 1) {
      const email = emails[0]!;
      const { error } = await resend.emails.send(toPayload(email), email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : undefined);
      if (error) {
        logger.error(`email failed  ${email.template} → ${email.to}`, error.message);
        return { retryable: isRetryable(error), message: error.message };
      }
      logger.info(`email sent  ${email.template} → ${email.to}`);
      return { retryable: false };
    }

    for (let index = 0; index < emails.length; index += BATCH_LIMIT) {
      const chunk = emails.slice(index, index + BATCH_LIMIT);
      const { error } = await resend.batch.send(chunk.map(toPayload));
      if (error) {
        logger.error(`email batch failed  ${chunk.length} messages`, error.message);
        return { retryable: isRetryable(error), message: error.message };
      }
      logger.info(`email batch sent  ${chunk.length} messages`);
    }
    return { retryable: false };
  } catch (error) {
    logger.error("email transport failed", error);
    return { retryable: true, message: error instanceof Error ? error.message : "Email transport failed." };
  }
}
