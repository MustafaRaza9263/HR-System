"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CirclePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { RichTextViewer } from "@/components/jobs/rich-text-viewer";
import { Dropdown } from "@/components/ui/dropdown";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiFormRequest, apiRequest } from "@/lib/api";
import type { ApplyResponse, PublicJobDetail, PublicJobDetailResponse } from "@/lib/applications/types";
import { ALLOWED_UPLOAD_ACCEPT, MAX_UPLOAD_BYTES } from "@/lib/applications/types";
import {
  buildApplyFormData,
  emptyEducation,
  emptyExperience,
  MAX_SECTION_ENTRIES,
  validateApplyForm,
  type ApplyFieldErrors,
  type ApplyFormValues,
} from "@/lib/applications/validate";
import type { CustomField, FieldSection } from "@/lib/jobs/types";
import { queryKeys } from "@/lib/query/query-keys";

const SECTION_ORDER: FieldSection[] = ["personal", "experience", "education"];
const SECTION_LABEL: Record<FieldSection, string> = {
  personal: "Personal",
  experience: "Experience",
  education: "Education",
};
const APPLY_HEADING_ID = "apply-for-this-job";
const NAME_FIELD_ID = "apply-candidate-name";
const APPLY_SCROLL_GAP_PX = 80;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

let applyScrollFrame = 0;

function focusNameField() {
  document.getElementById(NAME_FIELD_ID)?.focus({ preventScroll: true });
}

function scrollToApplyForm() {
  const heading = document.getElementById(APPLY_HEADING_ID);
  if (!heading) return;

  const top = Math.max(0, heading.getBoundingClientRect().top + window.scrollY - APPLY_SCROLL_GAP_PX);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    window.scrollTo(0, top);
    focusNameField();
    return;
  }

  const start = window.scrollY;
  const distance = top - start;
  if (Math.abs(distance) < 1) {
    focusNameField();
    return;
  }

  const duration = Math.min(1200, Math.max(560, Math.abs(distance) * 0.42));
  const token = ++applyScrollFrame;
  let startTime: number | null = null;

  function step(now: number) {
    if (token !== applyScrollFrame) return;
    if (startTime === null) startTime = now;
    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));
    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }
    focusNameField();
  }

  requestAnimationFrame(step);
}

const inputClass =
  "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    const fieldMessage = error.fields ? Object.values(error.fields).flat().find(Boolean) : undefined;
    return fieldMessage ?? error.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatSalary(min: number | null, max: number | null) {
  if (min === null || max === null) return null;
  const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  return `${format.format(min)} – ${format.format(max)}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{message}</p>;
}

function CustomFieldInput({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: CustomField;
  value: string | number | boolean | File | null | undefined;
  error?: string;
  disabled: boolean;
  onChange: (value: string | number | boolean | File | null) => void;
}) {
  const maxLength = field.constraint?.maxLength;
  const options = field.constraint?.options ?? [];

  if (field.type === "textarea") {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </span>
        <textarea
          className="min-h-28 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-neutral-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          disabled={disabled}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          value={typeof value === "string" ? value : ""}
        />
        <FieldError message={error} />
      </label>
    );
  }

  if (field.type === "number") {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </span>
        <input
          className={inputClass}
          disabled={disabled}
          max={field.constraint?.max}
          min={field.constraint?.min}
          onChange={(event) => onChange(event.target.value)}
          type="number"
          value={value === null || value === undefined || typeof value === "boolean" || value instanceof File ? "" : value}
        />
        <FieldError message={error} />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </span>
        <Dropdown
          aria-label={field.label}
          disabled={disabled}
          onChange={onChange}
          options={options.map((option) => ({ value: option, label: option }))}
          placeholder="Select…"
          value={typeof value === "string" ? value : ""}
        />
        <FieldError message={error} />
      </label>
    );
  }

  if (field.type === "date") {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </span>
        <input
          className={inputClass}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          type="date"
          value={typeof value === "string" ? value : ""}
        />
        <FieldError message={error} />
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 text-sm font-semibold">
        <input
          checked={value === true}
          className="mt-0.5 h-4 w-4"
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
          <FieldError message={error} />
        </span>
      </label>
    );
  }

  if (field.type === "file") {
    const file = value instanceof File ? value : null;
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </span>
        <input
          accept={ALLOWED_UPLOAD_ACCEPT}
          className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border file:border-neutral-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold dark:text-neutral-300 dark:file:border-gray-700 dark:file:bg-gray-900 dark:file:text-white"
          disabled={disabled}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          type="file"
        />
        <p className="mt-1 text-xs text-neutral-400">
          PDF or Word, up to 5 MB{file ? ` · ${file.name}` : ""}
        </p>
        <FieldError message={error} />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        className={inputClass}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={typeof value === "string" ? value : ""}
      />
      <FieldError message={error} />
    </label>
  );
}

function ApplyForm({ job }: { job: PublicJobDetail }) {
  const router = useRouter();
  const fields = job.fieldsConfig.customFields;
  const [values, setValues] = useState<ApplyFormValues>({
    candidateName: "",
    candidateEmail: "",
    candidatePhone: "",
    resume: null,
    answers: {},
    experience: [emptyExperience()],
    education: [emptyEducation()],
  });
  const [errors, setErrors] = useState<ApplyFieldErrors>({});

  const grouped = useMemo(() => {
    return SECTION_ORDER.map((section) => ({
      section,
      fields: fields.filter((field) => field.section === section),
    }));
  }, [fields]);

  const mutation = useMutation({
    mutationFn: async () => {
      const nextErrors = validateApplyForm(fields, values);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        throw new ApiClientError(422, "VALIDATION_ERROR", Object.values(nextErrors)[0] ?? "Check the form.");
      }
      if (!job.slug) {
        throw new ApiClientError(409, "JOB_NOT_OPEN", "This role is no longer accepting applications.");
      }
      return apiFormRequest<ApplyResponse>(
        `/careers/jobs/${job.slug}/apply`,
        buildApplyFormData(fields, values),
      );
    },
    onSuccess: () => {
      alerts.success("Application submitted. We'll be in touch.");
      router.push("/");
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        const mapped: ApplyFieldErrors = {};
        for (const [key, messages] of Object.entries(error.fields)) {
          const message = messages.find(Boolean);
          if (message) mapped[key] = message;
        }
        if (Object.keys(mapped).length) setErrors(mapped);
      }
      if (error instanceof ApiClientError && error.code === "VALIDATION_ERROR") return;
      alerts.error(errorMessage(error, "Application could not be submitted."));
    },
  });

  const busy = mutation.isPending;

  return (
    <form
      className="mt-10 space-y-8 border-t border-neutral-200 pt-10 dark:border-gray-800"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div>
        <h2
          className="scroll-mt-20 font-sans text-2xl font-bold tracking-tight text-neutral-950 sm:text-[1.75rem] dark:text-white"
          id={APPLY_HEADING_ID}
        >
          Apply for this job
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <span aria-hidden className="font-semibold text-red-500">
            *
          </span>{" "}
          indicates a required field
        </p>
      </div>

      {grouped.map((group) => (
        <section key={group.section}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            {SECTION_LABEL[group.section]}
          </h3>
          <div className="mt-4 space-y-4">
            {group.section === "personal" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Full name <span className="text-red-500">*</span>
                  </span>
                  <input
                    autoComplete="name"
                    className={inputClass}
                    disabled={busy}
                    id={NAME_FIELD_ID}
                    maxLength={120}
                    onChange={(event) => setValues((current) => ({ ...current, candidateName: event.target.value }))}
                    value={values.candidateName}
                  />
                  <FieldError message={errors.candidateName} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Email <span className="text-red-500">*</span>
                  </span>
                  <input
                    autoComplete="email"
                    className={inputClass}
                    disabled={busy}
                    maxLength={254}
                    onChange={(event) => setValues((current) => ({ ...current, candidateEmail: event.target.value }))}
                    type="email"
                    value={values.candidateEmail}
                  />
                  <FieldError message={errors.candidateEmail} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Phone <span className="text-red-500">*</span>
                  </span>
                  <input
                    autoComplete="tel"
                    className={inputClass}
                    disabled={busy}
                    maxLength={30}
                    onChange={(event) => setValues((current) => ({ ...current, candidatePhone: event.target.value }))}
                    type="tel"
                    value={values.candidatePhone}
                  />
                  <FieldError message={errors.candidatePhone} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Resume <span className="text-red-500">*</span>
                  </span>
                  <input
                    accept={ALLOWED_UPLOAD_ACCEPT}
                    className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border file:border-neutral-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold dark:text-neutral-300 dark:file:border-gray-700 dark:file:bg-gray-900 dark:file:text-white"
                    disabled={busy}
                    onChange={(event) => setValues((current) => ({ ...current, resume: event.target.files?.[0] ?? null }))}
                    type="file"
                  />
                  <p className="mt-1 text-xs text-neutral-400">
                    PDF or Word, up to {Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB
                    {values.resume ? ` · ${values.resume.name}` : ""}
                  </p>
                  <FieldError message={errors.resume} />
                </label>
              </>
            ) : null}

            {group.section === "experience" ? (
              <>
                {values.experience.map((entry, index) => (
                  <div className="rounded-2xl border border-neutral-200 p-4 dark:border-gray-800" key={entry.id}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">Experience {index + 1}</p>
                      {values.experience.length > 1 ? (
                        <button
                          aria-label={`Remove experience ${index + 1}`}
                          className="text-neutral-400 hover:text-red-600"
                          disabled={busy}
                          onClick={() =>
                            setValues((current) => ({
                              ...current,
                              experience: current.experience.filter((item) => item.id !== entry.id),
                            }))
                          }
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">
                          Company <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={inputClass}
                          disabled={busy}
                          maxLength={160}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              experience: current.experience.map((item) =>
                                item.id === entry.id ? { ...item, company: event.target.value } : item,
                              ),
                            }))
                          }
                          value={entry.company}
                        />
                        <FieldError message={errors[`experience.${index}.company`]} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">
                          Job title <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={inputClass}
                          disabled={busy}
                          maxLength={160}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              experience: current.experience.map((item) =>
                                item.id === entry.id ? { ...item, title: event.target.value } : item,
                              ),
                            }))
                          }
                          value={entry.title}
                        />
                        <FieldError message={errors[`experience.${index}.title`]} />
                      </label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold">
                            Start date <span className="text-red-500">*</span>
                          </span>
                          <input
                            className={inputClass}
                            disabled={busy}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                experience: current.experience.map((item) =>
                                  item.id === entry.id ? { ...item, startDate: event.target.value } : item,
                                ),
                              }))
                            }
                            type="date"
                            value={entry.startDate}
                          />
                          <FieldError message={errors[`experience.${index}.startDate`]} />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold">End date</span>
                          <input
                            className={inputClass}
                            disabled={busy}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                experience: current.experience.map((item) =>
                                  item.id === entry.id ? { ...item, endDate: event.target.value } : item,
                                ),
                              }))
                            }
                            type="date"
                            value={entry.endDate}
                          />
                          <p className="mt-1 text-xs text-neutral-400">Leave blank if this is your current role.</p>
                          <FieldError message={errors[`experience.${index}.endDate`]} />
                        </label>
                      </div>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">Description</span>
                        <textarea
                          className="min-h-24 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-neutral-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          disabled={busy}
                          maxLength={2000}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              experience: current.experience.map((item) =>
                                item.id === entry.id ? { ...item, description: event.target.value } : item,
                              ),
                            }))
                          }
                          value={entry.description}
                        />
                      </label>
                    </div>
                  </div>
                ))}
                {values.experience.length < MAX_SECTION_ENTRIES ? (
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-4 text-sm font-bold text-neutral-700 hover:border-neutral-400 dark:border-gray-700 dark:text-neutral-200"
                    disabled={busy}
                    onClick={() =>
                      setValues((current) => ({ ...current, experience: [...current.experience, emptyExperience()] }))
                    }
                    type="button"
                  >
                    <CirclePlus className="h-4 w-4" />
                    Add experience
                  </button>
                ) : null}
                <FieldError message={errors.experience} />
              </>
            ) : null}

            {group.section === "education" ? (
              <>
                {values.education.map((entry, index) => (
                  <div className="rounded-2xl border border-neutral-200 p-4 dark:border-gray-800" key={entry.id}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">Education {index + 1}</p>
                      {values.education.length > 1 ? (
                        <button
                          aria-label={`Remove education ${index + 1}`}
                          className="text-neutral-400 hover:text-red-600"
                          disabled={busy}
                          onClick={() =>
                            setValues((current) => ({
                              ...current,
                              education: current.education.filter((item) => item.id !== entry.id),
                            }))
                          }
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">
                          School <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={inputClass}
                          disabled={busy}
                          maxLength={160}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              education: current.education.map((item) =>
                                item.id === entry.id ? { ...item, school: event.target.value } : item,
                              ),
                            }))
                          }
                          value={entry.school}
                        />
                        <FieldError message={errors[`education.${index}.school`]} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">
                          Degree <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={inputClass}
                          disabled={busy}
                          maxLength={160}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              education: current.education.map((item) =>
                                item.id === entry.id ? { ...item, degree: event.target.value } : item,
                              ),
                            }))
                          }
                          value={entry.degree}
                        />
                        <FieldError message={errors[`education.${index}.degree`]} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">Field of study</span>
                        <input
                          className={inputClass}
                          disabled={busy}
                          maxLength={160}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              education: current.education.map((item) =>
                                item.id === entry.id ? { ...item, fieldOfStudy: event.target.value } : item,
                              ),
                            }))
                          }
                          value={entry.fieldOfStudy}
                        />
                      </label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold">Start date</span>
                          <input
                            className={inputClass}
                            disabled={busy}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                education: current.education.map((item) =>
                                  item.id === entry.id ? { ...item, startDate: event.target.value } : item,
                                ),
                              }))
                            }
                            type="date"
                            value={entry.startDate}
                          />
                          <FieldError message={errors[`education.${index}.startDate`]} />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold">End date</span>
                          <input
                            className={inputClass}
                            disabled={busy}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                education: current.education.map((item) =>
                                  item.id === entry.id ? { ...item, endDate: event.target.value } : item,
                                ),
                              }))
                            }
                            type="date"
                            value={entry.endDate}
                          />
                          <FieldError message={errors[`education.${index}.endDate`]} />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
                {values.education.length < MAX_SECTION_ENTRIES ? (
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-4 text-sm font-bold text-neutral-700 hover:border-neutral-400 dark:border-gray-700 dark:text-neutral-200"
                    disabled={busy}
                    onClick={() =>
                      setValues((current) => ({ ...current, education: [...current.education, emptyEducation()] }))
                    }
                    type="button"
                  >
                    <CirclePlus className="h-4 w-4" />
                    Add education
                  </button>
                ) : null}
                <FieldError message={errors.education} />
              </>
            ) : null}

            {group.fields.map((field) => (
              <CustomFieldInput
                disabled={busy}
                error={errors[field.id]}
                field={field}
                key={field.id}
                onChange={(value) =>
                  setValues((current) => ({
                    ...current,
                    answers: { ...current.answers, [field.id]: value },
                  }))
                }
                value={values.answers[field.id]}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
        <Link className="text-sm font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-white" href="/">
          Back to open roles
        </Link>
        <button
          className="inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950"
          disabled={busy}
          type="submit"
        >
          {busy ? "Submitting…" : "Apply"}
        </button>
      </div>
    </form>
  );
}

export function ApplyJobPage({ slug }: { slug: string }) {
  const jobQuery = useQuery({
    queryKey: queryKeys.careers.job(slug),
    queryFn: async () => apiRequest<PublicJobDetailResponse>(`/careers/jobs/${encodeURIComponent(slug)}`),
  });

  const job = jobQuery.data?.data.job;
  const accepting = job?.status === "open";

  return (
    <main className="flex min-h-svh flex-col bg-[#f7f7f5] text-neutral-900 [&_button]:font-[inherit] [&_input]:font-[inherit] [&_textarea]:font-[inherit] dark:bg-gray-950 dark:text-white">
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {jobQuery.isPending ? (
          <div aria-label="Loading role" className="space-y-4" role="status">
            <div className="h-10 max-w-sm animate-pulse rounded-xl bg-neutral-200 dark:bg-gray-800" />
            <div className="h-24 animate-pulse rounded-xl bg-neutral-200 dark:bg-gray-800" />
            <div className="h-64 animate-pulse rounded-xl bg-neutral-200 dark:bg-gray-800" />
          </div>
        ) : null}

        {jobQuery.isError ? (
          <div className="py-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Application</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em]">Role not found</h1>
            <p className="mt-3 text-sm text-neutral-500">This posting may have been removed or the link is incorrect.</p>
            <Link
              className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white dark:bg-white dark:text-neutral-950"
              href="/"
            >
              Back to open roles
            </Link>
          </div>
        ) : null}

        {job ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
              {job.departmentName}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{job.title}</h1>
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {[job.jobType, formatSalary(job.salaryMin, job.salaryMax)].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-8">
              {accepting ? (
                <div className="mb-6">
                  <button
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-bold text-white transition hover:bg-neutral-800 sm:w-auto dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                    onClick={scrollToApplyForm}
                    type="button"
                  >
                    Apply now
                  </button>
                </div>
              ) : null}
              <RichTextViewer
                proseClassName="text-[1.0625rem] leading-[1.7] text-neutral-800 dark:text-neutral-200 [&_h1]:mb-3 [&_h1]:mt-8 [&_h1]:text-[1.75rem] [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-[1.5rem] [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-bold [&_li]:my-2 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:font-bold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
                value={job.description}
              />
            </div>
            {accepting ? (
              <ApplyForm job={job} />
            ) : (
              <div className="mt-10 rounded-2xl border border-neutral-200 bg-white px-5 py-8 text-center dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm font-semibold">This role is no longer accepting applications.</p>
                <Link className="mt-4 inline-block text-sm font-bold text-indigo-600 dark:text-indigo-400" href="/">
                  Browse open roles
                </Link>
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
