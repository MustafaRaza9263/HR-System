import { logger } from "../../utils/logger.js";
import { renderEmail } from "./templates/index.js";
import { deliverEmails } from "./transport.js";
import type { EmailJob } from "./types.js";

const MAX_ATTEMPTS = 4;

type QueuedJob = EmailJob & { attempts: number };

const pending: QueuedJob[] = [];
let draining = false;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

export function enqueueEmail(job: EmailJob) {
  pending.push({ ...job, attempts: 0 });
  void drainEmailQueue();
}

export function enqueueEmails(jobs: EmailJob[]) {
  if (jobs.length === 0) return;
  pending.push(...jobs.map((job) => ({ ...job, attempts: 0 })));
  void drainEmailQueue();
}

export async function drainEmailQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (pending.length > 0) {
      const batch = pending.splice(0, 100);
      const rendered = batch.map((job) => renderEmail(job.template, job.to, job.data, job.idempotencyKey));
      const result = await deliverEmails(rendered);
      if (result.retryable) {
        const retryable = batch
          .map((job) => ({ ...job, attempts: job.attempts + 1 }))
          .filter((job) => job.attempts < MAX_ATTEMPTS);
        if (retryable.length > 0) {
          const delay = 1_000 * 2 ** (retryable[0]!.attempts - 1);
          logger.warn(`email retry in ${delay}ms  ${retryable.length} messages`);
          pending.unshift(...retryable);
          await sleep(delay);
        }
      }
    }
  } finally {
    draining = false;
    if (pending.length > 0) void drainEmailQueue();
  }
}
