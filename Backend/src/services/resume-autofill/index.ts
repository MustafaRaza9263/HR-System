import type { JobCustomField } from "../../utils/application-answers.js";
import { extractResumeText, type ResumeFileBytes } from "../../utils/extract-resume-text.js";
import { getLlmProvider } from "../llm/index.js";
import { resumeUnreadableError } from "../llm/unreadable.js";

import { AUTOFILL_SYSTEM_PROMPT, buildAutofillJsonSchema } from "./schema.js";
import { sanitizeAutofillFields, type AutofillFields } from "./sanitize.js";

const MAX_RESUME_CHARS = 80_000;

export type ResumeAutofillResult = {
  fields: AutofillFields;
  extractedFieldCount: number;
};

function clipResumeText(text: string) {
  if (text.length <= MAX_RESUME_CHARS) return text;
  return `${text.slice(0, MAX_RESUME_CHARS)}\n\n[Resume text truncated]`;
}

export async function autofillFromResume(input: {
  file: ResumeFileBytes;
  customFields: JobCustomField[];
}): Promise<ResumeAutofillResult> {
  const extracted = await extractResumeText(input.file);
  if (!extracted) throw resumeUnreadableError();

  const jsonSchema = buildAutofillJsonSchema(input.customFields);
  const raw = await getLlmProvider().generateStructured({
    systemPrompt: AUTOFILL_SYSTEM_PROMPT,
    userPrompt: `Extract application fields from this resume text:\n\n${clipResumeText(extracted)}`,
    jsonSchema,
  });

  return sanitizeAutofillFields(raw, input.customFields);
}
