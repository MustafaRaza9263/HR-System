/**
 * Post-apply side effects. Called fire-and-forget after a successful create.
 * Swap the bodies for real workers later — keep the function signatures.
 */

export function triggerScoring(applicationId: string) {
  // TODO: enqueue AI ranking worker (score + summary on Application)
  console.log("[side-effect] triggerScoring", { applicationId });
}

export function notifyHR(applicationId: string) {
  // TODO: deliver HR push / in-app notification for the new application
  console.log("[side-effect] notifyHR", { applicationId });
}

export function sendCandidateEmail(applicationId: string) {
  // TODO: send application confirmation email to the candidate
  console.log("[side-effect] sendCandidateEmail", { applicationId });
}

export function enqueueApplicationSideEffects(applicationId: string) {
  setImmediate(() => {
    try {
      triggerScoring(applicationId);
    } catch (error) {
      console.error("[side-effect] triggerScoring failed", error);
    }
    try {
      notifyHR(applicationId);
    } catch (error) {
      console.error("[side-effect] notifyHR failed", error);
    }
    try {
      sendCandidateEmail(applicationId);
    } catch (error) {
      console.error("[side-effect] sendCandidateEmail failed", error);
    }
  });
}
