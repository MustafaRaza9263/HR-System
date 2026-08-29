import { ApiError } from "./api-error.js";

export interface JobCustomField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "date" | "checkbox" | "file";
  required: boolean;
  constraint?: {
    maxLength?: number | null;
    min?: number | null;
    max?: number | null;
    options?: string[] | null;
  } | null;
  section: "personal" | "experience" | "education";
}

export interface SubmittedAnswer {
  fieldId: string;
  value: string | number | boolean | null;
}

export interface StoredAnswer {
  fieldId: string;
  label: string;
  type: JobCustomField["type"];
  section: JobCustomField["section"];
  value: string | number | boolean | null;
  fileName: string | null;
}

function isBlank(value: string | number | boolean | null | undefined) {
  return value === undefined || value === null || value === "";
}

function addFieldError(fields: Record<string, string[]>, key: string, message: string) {
  const current = fields[key] ?? [];
  current.push(message);
  fields[key] = current;
}

export function parseAnswersJson(raw: unknown): SubmittedAnswer[] {
  if (raw === undefined || raw === null || raw === "") return [];
  if (typeof raw !== "string") {
    throw new ApiError(422, "VALIDATION_ERROR", "Answers must be a JSON string.", {
      fields: { answers: ["Answers must be a JSON string."] },
    });
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("not array");
    }
    return parsed.map((item) => {
      if (!item || typeof item !== "object" || !("fieldId" in item)) {
        throw new Error("invalid item");
      }
      const entry = item as { fieldId: unknown; value?: unknown };
      if (typeof entry.fieldId !== "string" || !entry.fieldId.trim()) {
        throw new Error("invalid item");
      }
      const value = entry.value;
      if (
        value !== undefined &&
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
      ) {
        throw new Error("invalid item");
      }
      return {
        fieldId: entry.fieldId.trim(),
        value: value ?? null,
      };
    });
  } catch {
    throw new ApiError(422, "VALIDATION_ERROR", "Answers could not be parsed.", {
      fields: { answers: ["Answers could not be parsed."] },
    });
  }
}

export function validateCustomFieldAnswers(
  customFields: JobCustomField[],
  submitted: SubmittedAnswer[],
  filesByFieldId: Map<string, Express.Multer.File>,
): StoredAnswer[] {
  const fields: Record<string, string[]> = {};
  const submittedIds = new Set<string>();
  const byId = new Map<string, SubmittedAnswer>();

  for (const answer of submitted) {
    if (submittedIds.has(answer.fieldId)) {
      addFieldError(fields, answer.fieldId, "Duplicate answer for this field.");
      continue;
    }
    submittedIds.add(answer.fieldId);
    byId.set(answer.fieldId, answer);
  }

  const knownIds = new Set(customFields.map((field) => field.id));
  for (const fieldId of submittedIds) {
    if (!knownIds.has(fieldId)) {
      addFieldError(fields, fieldId, "This field is not part of the application.");
    }
  }

  const stored: StoredAnswer[] = [];

  for (const field of customFields) {
    if (field.type === "file") {
      const file = filesByFieldId.get(field.id);
      if (!file) {
        if (field.required) {
          addFieldError(fields, field.id, `Upload a file for ${field.label}.`);
        }
        continue;
      }
      stored.push({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        section: field.section,
        value: null,
        fileName: file.originalname,
      });
      continue;
    }

    const answer = byId.get(field.id);
    const raw = answer?.value ?? null;

    if (field.required) {
      if (field.type === "checkbox") {
        if (raw !== true) {
          addFieldError(fields, field.id, `${field.label} is required.`);
          continue;
        }
      } else if (isBlank(raw)) {
        addFieldError(fields, field.id, `${field.label} is required.`);
        continue;
      }
    }

    if (isBlank(raw) && field.type !== "checkbox") {
      continue;
    }

    if (field.type === "checkbox") {
      if (raw !== true && raw !== false) {
        if (field.required) {
          addFieldError(fields, field.id, `${field.label} is required.`);
        }
        continue;
      }
      stored.push({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        section: field.section,
        value: Boolean(raw),
        fileName: null,
      });
      continue;
    }

    if (field.type === "number") {
      const numeric = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
      if (!Number.isFinite(numeric)) {
        addFieldError(fields, field.id, `${field.label} must be a number.`);
        continue;
      }
      const min = field.constraint?.min;
      const max = field.constraint?.max;
      if (typeof min === "number" && numeric < min) {
        addFieldError(fields, field.id, `${field.label} must be at least ${min}.`);
        continue;
      }
      if (typeof max === "number" && numeric > max) {
        addFieldError(fields, field.id, `${field.label} must be at most ${max}.`);
        continue;
      }
      stored.push({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        section: field.section,
        value: numeric,
        fileName: null,
      });
      continue;
    }

    if (typeof raw !== "string") {
      addFieldError(fields, field.id, `${field.label} has an invalid value.`);
      continue;
    }

    const text = raw.trim();
    if (!text && !field.required) continue;

    if (field.type === "text" || field.type === "textarea") {
      const maxLength = field.constraint?.maxLength;
      if (typeof maxLength === "number" && text.length > maxLength) {
        addFieldError(fields, field.id, `${field.label} must be at most ${maxLength} characters.`);
        continue;
      }
    }

    if (field.type === "select") {
      const options = field.constraint?.options ?? [];
      if (!options.includes(text)) {
        addFieldError(fields, field.id, `Select a valid option for ${field.label}.`);
        continue;
      }
    }

    if (field.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00`))) {
        addFieldError(fields, field.id, `Enter a valid date for ${field.label}.`);
        continue;
      }
    }

    stored.push({
      fieldId: field.id,
      label: field.label,
      type: field.type,
      section: field.section,
      value: text,
      fileName: null,
    });
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "The request contains invalid values.", { fields });
  }

  return stored;
}
