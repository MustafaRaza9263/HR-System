import type { CustomField } from "@/lib/jobs/types";
import { getStoredUtm } from "@/lib/utm";

import { MAX_UPLOAD_BYTES } from "./types";

export interface ExperienceFormEntry {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface EducationFormEntry {
  id: string;
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
}

export interface ApplyFormValues {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  resume: File | null;
  answers: Record<string, string | number | boolean | File | null>;
  experience: ExperienceFormEntry[];
  education: EducationFormEntry[];
}

export type ApplyFieldErrors = Record<string, string>;

export const MAX_SECTION_ENTRIES = 8;

export function emptyExperience(): ExperienceFormEntry {
  return { id: createEntryId(), company: "", title: "", startDate: "", endDate: "", description: "" };
}

export function emptyEducation(): EducationFormEntry {
  return { id: createEntryId(), school: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "" };
}

function createEntryId() {
  return `entry_${Math.random().toString(36).slice(2, 10)}`;
}

function isAllowedUpload(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");
}

export function validateUploadFile(file: File | null, label: string, required: boolean): string | null {
  if (!file) return required ? `Upload a file for ${label}.` : null;
  if (file.size > MAX_UPLOAD_BYTES) return `${label} must be 5 MB or smaller.`;
  if (!isAllowedUpload(file)) return `${label} must be a PDF or Word document.`;
  return null;
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

export function validateApplyForm(fields: CustomField[], values: ApplyFormValues): ApplyFieldErrors {
  const errors: ApplyFieldErrors = {};
  const name = values.candidateName.trim();
  if (!name) errors.candidateName = "Enter your name.";
  else if (name.length > 120) errors.candidateName = "Name must be at most 120 characters.";

  const email = values.candidateEmail.trim();
  if (!email) errors.candidateEmail = "Enter your email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.candidateEmail = "Enter a valid email.";

  const phone = values.candidatePhone.trim();
  if (!phone) errors.candidatePhone = "Enter your phone number.";
  else if (!/^[+\d][\d\s().-]*$/.test(phone) || phone.replace(/\D/g, "").length < 7) {
    errors.candidatePhone = "Enter a valid phone number.";
  }

  const resumeError = validateUploadFile(values.resume, "Resume", true);
  if (resumeError) errors.resume = resumeError;

  if (values.experience.length < 1) errors.experience = "Add at least one experience.";
  values.experience.forEach((entry, index) => {
    if (!entry.company.trim()) errors[`experience.${index}.company`] = "Enter a company.";
    if (!entry.title.trim()) errors[`experience.${index}.title`] = "Enter a job title.";
    if (!isValidDate(entry.startDate)) errors[`experience.${index}.startDate`] = "Enter a start date.";
    if (entry.endDate && !isValidDate(entry.endDate)) errors[`experience.${index}.endDate`] = "Enter a valid end date.";
    if (isValidDate(entry.startDate) && isValidDate(entry.endDate) && entry.endDate < entry.startDate) {
      errors[`experience.${index}.endDate`] = "End date must be on or after the start date.";
    }
  });

  if (values.education.length < 1) errors.education = "Add at least one education.";
  values.education.forEach((entry, index) => {
    if (!entry.school.trim()) errors[`education.${index}.school`] = "Enter a school.";
    if (!entry.degree.trim()) errors[`education.${index}.degree`] = "Enter a degree.";
    if (entry.startDate && !isValidDate(entry.startDate)) errors[`education.${index}.startDate`] = "Enter a valid start date.";
    if (entry.endDate && !isValidDate(entry.endDate)) errors[`education.${index}.endDate`] = "Enter a valid end date.";
    if (isValidDate(entry.startDate) && isValidDate(entry.endDate) && entry.endDate < entry.startDate) {
      errors[`education.${index}.endDate`] = "End date must be on or after the start date.";
    }
  });

  for (const field of fields) {
    const raw = values.answers[field.id];

    if (field.type === "file") {
      const file = raw instanceof File ? raw : null;
      const error = validateUploadFile(file, field.label, field.required);
      if (error) errors[field.id] = error;
      continue;
    }

    if (field.type === "checkbox") {
      if (field.required && raw !== true) {
        errors[field.id] = `${field.label} is required.`;
      }
      continue;
    }

    if (field.type === "number") {
      if (raw === "" || raw === null || raw === undefined) {
        if (field.required) errors[field.id] = `${field.label} is required.`;
        continue;
      }
      const numeric = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(numeric)) {
        errors[field.id] = `${field.label} must be a number.`;
        continue;
      }
      if (typeof field.constraint?.min === "number" && numeric < field.constraint.min) {
        errors[field.id] = `${field.label} must be at least ${field.constraint.min}.`;
      }
      if (typeof field.constraint?.max === "number" && numeric > field.constraint.max) {
        errors[field.id] = `${field.label} must be at most ${field.constraint.max}.`;
      }
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) {
      if (field.required) errors[field.id] = `${field.label} is required.`;
      continue;
    }

    if ((field.type === "text" || field.type === "textarea") && typeof field.constraint?.maxLength === "number") {
      if (text.length > field.constraint.maxLength) {
        errors[field.id] = `${field.label} must be at most ${field.constraint.maxLength} characters.`;
      }
    }

    if (field.type === "select") {
      const options = field.constraint?.options ?? [];
      if (!options.includes(text)) errors[field.id] = `Select a valid option for ${field.label}.`;
    }

    if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00`)))) {
      errors[field.id] = `Enter a valid date for ${field.label}.`;
    }
  }

  return errors;
}

export function buildApplyFormData(fields: CustomField[], values: ApplyFormValues) {
  const formData = new FormData();
  formData.append("candidateName", values.candidateName.trim());
  formData.append("candidateEmail", values.candidateEmail.trim());
  formData.append("candidatePhone", values.candidatePhone.trim());
  if (values.resume) formData.append("resume", values.resume);

  const answers: Array<{ fieldId: string; value: string | number | boolean | null }> = [];
  for (const field of fields) {
    const raw = values.answers[field.id];
    if (field.type === "file") {
      if (raw instanceof File) formData.append(`file_${field.id}`, raw);
      continue;
    }
    if (field.type === "checkbox") {
      answers.push({ fieldId: field.id, value: raw === true });
      continue;
    }
    if (field.type === "number") {
      if (raw === "" || raw === null || raw === undefined) continue;
      const numeric = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(numeric)) answers.push({ fieldId: field.id, value: numeric });
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text) answers.push({ fieldId: field.id, value: text });
  }

  formData.append("answers", JSON.stringify(answers));
  formData.append(
    "experience",
    JSON.stringify(
      values.experience.map((entry) => ({
        company: entry.company.trim(),
        title: entry.title.trim(),
        startDate: entry.startDate,
        endDate: entry.endDate,
        description: entry.description.trim(),
      })),
    ),
  );
  formData.append(
    "education",
    JSON.stringify(
      values.education.map((entry) => ({
        school: entry.school.trim(),
        degree: entry.degree.trim(),
        fieldOfStudy: entry.fieldOfStudy.trim(),
        startDate: entry.startDate,
        endDate: entry.endDate,
      })),
    ),
  );

  const utm = getStoredUtm();
  if (utm.source) formData.append("utm_source", utm.source);
  if (utm.campaign) formData.append("utm_campaign", utm.campaign);

  return formData;
}
