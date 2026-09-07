import {
  applySystemFieldsSchema,
  MARITAL_STATUS_VALUES,
  maritalStatusEnum,
  salaryCurrencyEnum,
} from "../../schemas/application.schema.js";
import type { JobCustomField } from "../../utils/application-answers.js";

const MAX_ENTRIES = 8;

export type AutofillExperience = {
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  currentlyWorking?: boolean;
  salary?: number;
  salaryCurrency?: string;
  description?: string;
};

export type AutofillEducation = {
  school?: string;
  degree?: string;
  fieldOfStudy?: string;
  cgpaPercentage?: string;
  startDate?: string;
  endDate?: string;
};

export type AutofillFields = {
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateDateOfBirth?: string;
  candidateCnic?: string;
  candidateMaritalStatus?: string;
  candidateAlternativePhone?: string;
  expectedSalary?: number;
  expectedSalaryCurrency?: string;
  experience?: AutofillExperience[];
  education?: AutofillEducation[];
  answers?: Record<string, string | number | boolean>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePicked<T>(
  result: { success: true; data: T } | { success: false },
): T | undefined {
  return result.success ? result.data : undefined;
}

function skipBlank(value: unknown) {
  return value === undefined || value === null || value === "";
}

function setIfPresent<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined) {
  if (value === undefined || value === null || value === "") return;
  target[key] = value;
}

function normalizeMaritalStatus(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const exact = maritalStatusEnum.safeParse(trimmed);
  if (exact.success) return exact.data;
  const match = MARITAL_STATUS_VALUES.find((option) => option.toLowerCase() === trimmed.toLowerCase());
  return match;
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(Date.parse(`${trimmed}T00:00:00`))) return undefined;
  return trimmed;
}

function parseTrimmed(value: unknown, max: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > max) return undefined;
  return trimmed;
}

function parseBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function parseSalaryAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000) return value;
  if (typeof value === "string") {
    const numeric = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 1_000_000_000_000) return numeric;
  }
  return undefined;
}

function hasOwnValues(value: object) {
  return Object.keys(value).length > 0;
}

function sanitizeExperienceEntry(raw: unknown): AutofillExperience | null {
  if (!isRecord(raw)) return null;
  const entry: AutofillExperience = {};
  setIfPresent(entry, "company", parseTrimmed(raw.company, 160));
  setIfPresent(entry, "title", parseTrimmed(raw.title, 160));
  setIfPresent(entry, "startDate", parseDate(raw.startDate));
  const currentlyWorking = parseBoolean(raw.currentlyWorking);
  if (currentlyWorking !== undefined) entry.currentlyWorking = currentlyWorking;
  if (!currentlyWorking) {
    const endDate = parseDate(raw.endDate);
    if (endDate && (!entry.startDate || endDate >= entry.startDate)) entry.endDate = endDate;
  }
  const salary = parseSalaryAmount(raw.salary);
  if (salary !== undefined) {
    entry.salary = salary;
    const currency = salaryCurrencyEnum.safeParse(
      typeof raw.salaryCurrency === "string" ? raw.salaryCurrency.trim().toUpperCase() : raw.salaryCurrency,
    );
    if (currency.success) entry.salaryCurrency = currency.data;
  }
  setIfPresent(entry, "description", parseTrimmed(raw.description, 2000));
  return hasOwnValues(entry) ? entry : null;
}

function sanitizeEducationEntry(raw: unknown): AutofillEducation | null {
  if (!isRecord(raw)) return null;
  const entry: AutofillEducation = {};
  setIfPresent(entry, "school", parseTrimmed(raw.school, 160));
  setIfPresent(entry, "degree", parseTrimmed(raw.degree, 160));
  setIfPresent(entry, "fieldOfStudy", parseTrimmed(raw.fieldOfStudy, 160));
  setIfPresent(entry, "cgpaPercentage", parseTrimmed(raw.cgpaPercentage, 40));
  setIfPresent(entry, "startDate", parseDate(raw.startDate));
  const endDate = parseDate(raw.endDate);
  if (endDate && (!entry.startDate || endDate >= entry.startDate)) entry.endDate = endDate;
  return hasOwnValues(entry) ? entry : null;
}

function sanitizeCustomAnswer(field: JobCustomField, raw: unknown): string | number | boolean | undefined {
  if (field.type === "file" || raw === undefined || raw === null || raw === "") return undefined;

  if (field.type === "checkbox") {
    return typeof raw === "boolean" ? raw : undefined;
  }

  if (field.type === "number") {
    const numeric = parseSalaryAmount(raw);
    if (numeric === undefined) return undefined;
    const min = field.constraint?.min;
    const max = field.constraint?.max;
    if (typeof min === "number" && numeric < min) return undefined;
    if (typeof max === "number" && numeric > max) return undefined;
    return numeric;
  }

  if (typeof raw !== "string") return undefined;
  const text = raw.trim();
  if (!text) return undefined;

  if ((field.type === "text" || field.type === "textarea") && typeof field.constraint?.maxLength === "number") {
    if (text.length > field.constraint.maxLength) return undefined;
  }

  if (field.type === "select") {
    const options = field.constraint?.options ?? [];
    const match = options.find((option) => option.toLowerCase() === text.toLowerCase());
    return match;
  }

  if (field.type === "date") return parseDate(text);

  return text;
}

function countFields(fields: AutofillFields) {
  let count = 0;
  if (fields.candidateName) count += 1;
  if (fields.candidateEmail) count += 1;
  if (fields.candidatePhone) count += 1;
  if (fields.candidateDateOfBirth) count += 1;
  if (fields.candidateCnic) count += 1;
  if (fields.candidateMaritalStatus) count += 1;
  if (fields.candidateAlternativePhone) count += 1;
  if (fields.expectedSalary !== undefined) count += 1;
  count += fields.experience?.length ?? 0;
  count += fields.education?.length ?? 0;
  count += fields.answers ? Object.keys(fields.answers).length : 0;
  return count;
}

/**
 * Drops hallucinated keys and values that would fail apply-time validation.
 * Partial output is expected — missing fields stay absent.
 */
export function sanitizeAutofillFields(raw: unknown, customFields: JobCustomField[]): {
  fields: AutofillFields;
  extractedFieldCount: number;
} {
  const source = isRecord(raw) ? raw : {};
  const fields: AutofillFields = {};

  if (!skipBlank(source.candidateName)) {
    const parsed = parsePicked(applySystemFieldsSchema.pick({ candidateName: true }).safeParse({ candidateName: source.candidateName }));
    setIfPresent(fields, "candidateName", parsed?.candidateName);
  }
  if (!skipBlank(source.candidateEmail)) {
    const parsed = parsePicked(applySystemFieldsSchema.pick({ candidateEmail: true }).safeParse({ candidateEmail: source.candidateEmail }));
    setIfPresent(fields, "candidateEmail", parsed?.candidateEmail);
  }
  if (!skipBlank(source.candidatePhone)) {
    const parsed = parsePicked(applySystemFieldsSchema.pick({ candidatePhone: true }).safeParse({ candidatePhone: source.candidatePhone }));
    setIfPresent(fields, "candidatePhone", parsed?.candidatePhone);
  }
  if (!skipBlank(source.candidateDateOfBirth)) {
    const parsed = parsePicked(
      applySystemFieldsSchema.pick({ candidateDateOfBirth: true }).safeParse({ candidateDateOfBirth: source.candidateDateOfBirth }),
    );
    setIfPresent(fields, "candidateDateOfBirth", parsed?.candidateDateOfBirth);
  }
  if (!skipBlank(source.candidateCnic)) {
    const parsed = parsePicked(applySystemFieldsSchema.pick({ candidateCnic: true }).safeParse({ candidateCnic: source.candidateCnic }));
    setIfPresent(fields, "candidateCnic", parsed?.candidateCnic);
  }
  setIfPresent(fields, "candidateMaritalStatus", normalizeMaritalStatus(source.candidateMaritalStatus));
  if (!skipBlank(source.candidateAlternativePhone)) {
    const parsed = parsePicked(
      applySystemFieldsSchema
        .pick({ candidateAlternativePhone: true })
        .safeParse({ candidateAlternativePhone: source.candidateAlternativePhone }),
    );
    setIfPresent(fields, "candidateAlternativePhone", parsed?.candidateAlternativePhone);
  }

  if (!skipBlank(source.expectedSalary)) {
    const parsed = parsePicked(
      applySystemFieldsSchema.pick({ expectedSalary: true, expectedSalaryCurrency: true }).safeParse({
        expectedSalary: source.expectedSalary,
        expectedSalaryCurrency: skipBlank(source.expectedSalaryCurrency) ? "PKR" : source.expectedSalaryCurrency,
      }),
    );
    if (parsed) {
      fields.expectedSalary = parsed.expectedSalary;
      fields.expectedSalaryCurrency = parsed.expectedSalaryCurrency;
    }
  }

  if (Array.isArray(source.experience)) {
    const experience = source.experience
      .map(sanitizeExperienceEntry)
      .filter((entry): entry is AutofillExperience => entry !== null)
      .slice(0, MAX_ENTRIES);
    if (experience.length > 0) fields.experience = experience;
  }

  if (Array.isArray(source.education)) {
    const education = source.education
      .map(sanitizeEducationEntry)
      .filter((entry): entry is AutofillEducation => entry !== null)
      .slice(0, MAX_ENTRIES);
    if (education.length > 0) fields.education = education;
  }

  const answersRaw = isRecord(source.answers) ? source.answers : source;
  const answers: Record<string, string | number | boolean> = {};
  for (const field of customFields) {
    const value = sanitizeCustomAnswer(field, answersRaw[field.id]);
    if (value !== undefined) answers[field.id] = value;
  }
  if (Object.keys(answers).length > 0) fields.answers = answers;

  return { fields, extractedFieldCount: countFields(fields) };
}
