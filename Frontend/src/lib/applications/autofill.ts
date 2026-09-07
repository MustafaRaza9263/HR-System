import { DEFAULT_SALARY_CURRENCY, formatSalaryDigits } from "@/lib/applications/salary";
import type { ResumeAutofillEducation, ResumeAutofillExperience, ResumeAutofillFields } from "@/lib/applications/types";

import { emptyEducation, emptyExperience, MAX_SECTION_ENTRIES, type ApplyFormValues } from "./validate";

function mapExperience(entry: ResumeAutofillExperience) {
  return {
    ...emptyExperience(),
    company: entry.company ?? "",
    title: entry.title ?? "",
    startDate: entry.startDate ?? "",
    endDate: entry.currentlyWorking ? "" : (entry.endDate ?? ""),
    currentlyWorking: Boolean(entry.currentlyWorking),
    salary: typeof entry.salary === "number" ? formatSalaryDigits(String(Math.round(entry.salary))) : "",
    salaryCurrency: entry.salaryCurrency ?? DEFAULT_SALARY_CURRENCY,
    description: entry.description ?? "",
  };
}

function mapEducation(entry: ResumeAutofillEducation) {
  return {
    ...emptyEducation(),
    school: entry.school ?? "",
    degree: entry.degree ?? "",
    fieldOfStudy: entry.fieldOfStudy ?? "",
    cgpaPercentage: entry.cgpaPercentage ?? "",
    startDate: entry.startDate ?? "",
    endDate: entry.endDate ?? "",
  };
}

/** Merges confident autofill values into the form. Empty payload keys are left untouched. */
export function applyAutofillToForm(
  current: ApplyFormValues,
  fields: ResumeAutofillFields,
  resume: File,
): ApplyFormValues {
  const next: ApplyFormValues = { ...current, resume, answers: { ...current.answers } };

  if (fields.candidateName) next.candidateName = fields.candidateName;
  if (fields.candidateEmail) next.candidateEmail = fields.candidateEmail;
  if (fields.candidatePhone) next.candidatePhone = fields.candidatePhone;
  if (fields.candidateDateOfBirth) next.candidateDateOfBirth = fields.candidateDateOfBirth;
  if (fields.candidateCnic) next.candidateCnic = fields.candidateCnic;
  if (fields.candidateMaritalStatus) next.candidateMaritalStatus = fields.candidateMaritalStatus;
  if (fields.candidateAlternativePhone) next.candidateAlternativePhone = fields.candidateAlternativePhone;
  if (typeof fields.expectedSalary === "number") {
    next.expectedSalary = formatSalaryDigits(String(Math.round(fields.expectedSalary)));
    if (fields.expectedSalaryCurrency) next.expectedSalaryCurrency = fields.expectedSalaryCurrency;
  }

  if (fields.experience && fields.experience.length > 0) {
    next.experience = fields.experience.slice(0, MAX_SECTION_ENTRIES).map(mapExperience);
  }
  if (fields.education && fields.education.length > 0) {
    next.education = fields.education.slice(0, MAX_SECTION_ENTRIES).map(mapEducation);
  }

  if (fields.answers) {
    for (const [fieldId, value] of Object.entries(fields.answers)) {
      next.answers[fieldId] = value;
    }
  }

  return next;
}
