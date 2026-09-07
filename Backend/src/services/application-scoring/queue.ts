import { logger } from "../../utils/logger.js";

import { markScoringFailed, scoreApplication } from "./index.js";

const MAX_ATTEMPTS = 4;

type QueuedJob = { applicationId: string; attempts: number };

const pending: QueuedJob[] = [];
let draining = false;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

export function enqueueScoring(applicationId: string) {
  if (pending.some((job) => job.applicationId === applicationId)) return;
  pending.push({ applicationId, attempts: 0 });
  void drainScoringQueue();
}

export async function drainScoringQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (pending.length > 0) {
      const job = pending.shift();
      if (!job) continue;
      try {
        await scoreApplication(job.applicationId);
      } catch (error) {
        const attempts = job.attempts + 1;
        logger.warn(`scoring ${job.applicationId}  attempt ${String(attempts)} failed`);
        if (attempts < MAX_ATTEMPTS) {
          const delay = 1_000 * 2 ** (attempts - 1);
          logger.info(`scoring ${job.applicationId}  retry in ${String(delay)}ms`);
          pending.unshift({ applicationId: job.applicationId, attempts });
          await sleep(delay);
        } else {
          logger.error(`scoring ${job.applicationId}  failed after ${String(MAX_ATTEMPTS)} attempts`, error);
          await markScoringFailed(job.applicationId);
        }
      }
    }
  } finally {
    draining = false;
    if (pending.length > 0) void drainScoringQueue();
  }
}
