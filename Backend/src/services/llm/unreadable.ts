import { ApiError } from "../../utils/api-error.js";

export const RESUME_UNREADABLE_MESSAGE = "Couldn't read this resume — please fill the form manually.";

export function resumeUnreadableError() {
  return new ApiError(422, "RESUME_UNREADABLE", RESUME_UNREADABLE_MESSAGE);
}
