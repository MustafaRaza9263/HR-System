import { MARITAL_STATUS_VALUES, SALARY_CURRENCY_CODES } from "../../schemas/application.schema.js";
import type { JobCustomField } from "../../utils/application-answers.js";
import type { JsonSchema } from "../llm/types.js";

const EXPERIENCE_ITEM_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    company: { type: ["string", "null"], description: "Employer or company name" },
    title: { type: ["string", "null"], description: "Job title" },
    startDate: { type: ["string", "null"], description: "Start date as YYYY-MM-DD" },
    endDate: { type: ["string", "null"], description: "End date as YYYY-MM-DD; null if currently working" },
    currentlyWorking: { type: ["boolean", "null"] },
    salary: { type: ["number", "null"], description: "Numeric salary amount if stated" },
    salaryCurrency: { type: ["string", "null"], enum: [...SALARY_CURRENCY_CODES] },
    description: { type: ["string", "null"], description: "Role summary", maxLength: 2000 },
  },
};

const EDUCATION_ITEM_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    school: { type: ["string", "null"] },
    degree: { type: ["string", "null"] },
    fieldOfStudy: { type: ["string", "null"] },
    cgpaPercentage: { type: ["string", "null"], description: "CGPA or percentage as written" },
    startDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
    endDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
  },
};

function customFieldSchema(field: JobCustomField): JsonSchema | null {
  if (field.type === "file") return null;

  if (field.type === "checkbox") {
    return { type: ["boolean", "null"], description: field.label };
  }

  if (field.type === "number") {
    const schema: JsonSchema = { type: ["number", "null"], description: field.label };
    if (typeof field.constraint?.min === "number") schema.minimum = field.constraint.min;
    if (typeof field.constraint?.max === "number") schema.maximum = field.constraint.max;
    return schema;
  }

  if (field.type === "select") {
    const options = field.constraint?.options ?? [];
    if (options.length === 0) return null;
    return { type: ["string", "null"], description: field.label, enum: options };
  }

  const schema: JsonSchema = {
    type: ["string", "null"],
    description:
      field.type === "date"
        ? `${field.label} as YYYY-MM-DD`
        : field.type === "url"
          ? `${field.label} as an http or https URL`
          : field.label,
  };
  if (
    (field.type === "text" || field.type === "textarea" || field.type === "url") &&
    typeof field.constraint?.maxLength === "number"
  ) {
    schema.maxLength = field.constraint.maxLength;
  }
  return schema;
}

export function buildAutofillJsonSchema(customFields: JobCustomField[]): JsonSchema {
  const answersProperties: Record<string, JsonSchema> = {};
  for (const field of customFields) {
    const schema = customFieldSchema(field);
    if (!schema) continue;
    answersProperties[field.id] = schema;
  }

  const properties: Record<string, JsonSchema> = {
    candidateName: { type: ["string", "null"], description: "Full name", maxLength: 120 },
    candidateEmail: { type: ["string", "null"], description: "Email address" },
    candidatePhone: { type: ["string", "null"], description: "Primary phone in E.164 (+countrycode...)" },
    candidateDateOfBirth: { type: ["string", "null"], description: "Date of birth YYYY-MM-DD" },
    candidateCnic: { type: ["string", "null"], description: "CNIC 13 digits as xxxxx-xxxxxxx-x" },
    candidateMaritalStatus: {
      type: ["string", "null"],
      enum: [...MARITAL_STATUS_VALUES],
    },
    candidateAlternativePhone: { type: ["string", "null"], description: "Optional alternate phone in E.164" },
    expectedSalary: { type: ["number", "null"], description: "Expected monthly salary amount" },
    expectedSalaryCurrency: { type: ["string", "null"], enum: [...SALARY_CURRENCY_CODES] },
    experience: { type: "array", maxItems: 8, items: EXPERIENCE_ITEM_SCHEMA },
    education: { type: "array", maxItems: 8, items: EDUCATION_ITEM_SCHEMA },
  };

  if (Object.keys(answersProperties).length > 0) {
    properties.answers = {
      type: "object",
      additionalProperties: false,
      description: "Custom job-field values keyed by the provided field ids only",
      properties: answersProperties,
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
  };
}

export const AUTOFILL_SYSTEM_PROMPT = `You extract job-application fields from resume text.
Return JSON matching the provided schema.
Use null when a value is not clearly present in the resume.
Do not invent names, emails, phones, dates, employers, schools, salaries, or custom-field values.
Dates must be YYYY-MM-DD.
Phone numbers must be E.164 (start with + and the country calling code).
CNIC must be 13 digits.
Select and marital-status values must match the schema enums exactly.
URL fields must be a full http or https URL.
Never add keys that are not in the schema.`;
