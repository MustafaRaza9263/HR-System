import { notifyHR } from "../notifications/index.js";
import { logger } from "../utils/logger.js";

export function enqueueApplicationSideEffects(applicationId: string) {
  setImmediate(() => {
    void notifyHR("new_application", applicationId).catch((error) => {
      logger.error("notifyHR failed", error);
    });
  });
}
