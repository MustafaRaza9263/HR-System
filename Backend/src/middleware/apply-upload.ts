import type { RequestHandler } from "express";
import multer from "multer";

import { MAX_UPLOAD_BYTES } from "../constants/uploads.js";
import { ApiError } from "../utils/api-error.js";

const applyMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 12 },
});

const parseAny = applyMulter.any();

export const handleApplyUpload: RequestHandler = (request, response, next) => {
  parseAny(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(new ApiError(422, "FILE_TOO_LARGE", "Each file must be 5 MB or smaller."));
        return;
      }
      next(new ApiError(422, "UPLOAD_FAILED", "The file could not be uploaded."));
      return;
    }
    next(error);
  });
};
