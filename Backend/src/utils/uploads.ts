import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { randomUUID } from "node:crypto";

import {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from "../constants/uploads.js";
import { ApiError } from "./api-error.js";

export const uploadsRoot = join(process.cwd(), "uploads");

type UploadFolder = "resumes" | "fields";

function assertSafeExtension(originalName: string) {
  const ext = extname(originalName).toLowerCase();
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ApiError(422, "INVALID_FILE_TYPE", "Only PDF and Word documents are accepted.");
  }
  return ext;
}

export function assertAllowedUpload(file: Express.Multer.File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(422, "FILE_TOO_LARGE", "Each file must be 5 MB or smaller.");
  }
  const mimeOk = (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.mimetype);
  const ext = extname(file.originalname).toLowerCase();
  const extOk = (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
  if (!mimeOk && !extOk) {
    throw new ApiError(422, "INVALID_FILE_TYPE", "Only PDF and Word documents are accepted.");
  }
  if (!extOk) {
    throw new ApiError(422, "INVALID_FILE_TYPE", "Only PDF and Word documents are accepted.");
  }
}

export async function saveUpload(file: Express.Multer.File, folder: UploadFolder) {
  assertAllowedUpload(file);
  const ext = assertSafeExtension(file.originalname);
  const relative = `${folder}/${randomUUID()}${ext}`;
  await mkdir(join(uploadsRoot, folder), { recursive: true });
  await writeFile(join(uploadsRoot, relative), file.buffer);
  return {
    relative,
    originalName: file.originalname.replace(/[\r\n"]/g, "_").slice(0, 255) || `upload${ext}`,
  };
}

export function resolveUploadPath(relative: string) {
  const normalized = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = join(uploadsRoot, normalized);
  const rootWithSep = uploadsRoot.endsWith(sep) ? uploadsRoot : `${uploadsRoot}${sep}`;
  if (absolute !== uploadsRoot && !absolute.startsWith(rootWithSep)) {
    throw new ApiError(400, "INVALID_PATH", "Invalid file path.");
  }
  return absolute;
}

export function contentDispositionFilename(filename: string) {
  return filename.replace(/[\r\n"]/g, "_").slice(0, 180) || "resume.pdf";
}
