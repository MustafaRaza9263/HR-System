import { Types } from "mongoose";

import { ApiError } from "./api-error.js";

export function assertObjectId(id: string, notFoundCode: string, notFoundMessage: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(404, notFoundCode, notFoundMessage);
  }
}
