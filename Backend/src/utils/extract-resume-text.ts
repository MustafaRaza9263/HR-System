import { extname } from "node:path";

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

const MIN_MEANINGFUL_CHARS = 30;

export type ResumeFileBytes = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

type ResumeKind = "pdf" | "docx" | "doc";

function meaningfulLength(text: string) {
  return text.replace(/[^A-Za-z0-9]/g, "").length;
}

function usableText(text: string): string | null {
  const normalized = text.replace(/[ \t]+\n/g, "\n").trim();
  if (meaningfulLength(normalized) < MIN_MEANINGFUL_CHARS) return null;
  return normalized;
}

function resumeKind(file: ResumeFileBytes): ResumeKind | null {
  const ext = extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();
  if (ext === ".pdf" || mime === "application/pdf") return "pdf";
  if (ext === ".docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "docx";
  }
  if (ext === ".doc" || mime === "application/msword") return "doc";
  return null;
}

async function extractPdfText(buffer: Buffer) {
  const bytes = Uint8Array.from(buffer);
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: true });
  return extracted.text;
}

/**
 * Pulls plain text from a resume buffer. Returns null when the file is
 * unreadable (legacy .doc, scanned/image PDF, empty extract, or parser error).
 * Does not persist anything. Reused by application scoring.
 */
export async function extractResumeText(file: ResumeFileBytes): Promise<string | null> {
  const kind = resumeKind(file);
  if (kind === null || kind === "doc") return null;

  try {
    if (kind === "pdf") {
      return usableText(await extractPdfText(file.buffer));
    }
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return usableText(result.value);
  } catch {
    return null;
  }
}
