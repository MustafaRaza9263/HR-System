"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CirclePlus,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import { RichTextEditor } from "@/components/jobs/rich-text-editor";
import { RichTextViewer } from "@/components/jobs/rich-text-viewer";
import { Dropdown } from "@/components/ui/dropdown";
import { Modal } from "@/components/ui/modal";
import { TagInput, commitTagDraft } from "@/components/ui/tag-input";
import { ToggleRow } from "@/components/ui/toggle-row";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import {
  FIELD_SECTIONS,
  FIELD_TYPES,
  JOB_TYPES,
  createFieldId,
  emptyRichTextDoc,
  type CustomField,
  type CustomFieldType,
  type FieldSection,
  type Job,
  type JobDraftPayload,
  type JobResponse,
  type JobType,
  type RichTextDoc,
} from "@/lib/jobs/types";
import { queryKeys } from "@/lib/query/query-keys";

interface Department {
  id: string;
  name: string;
  status: "active" | "inactive";
}

interface Role {
  id: string;
  name: string;
  departmentId: string;
  status: "active" | "inactive";
}

interface DepartmentResponse {
  data: { departments: Department[] };
}

interface RoleResponse {
  data: { roles: Role[] };
}

const STEPS = ["Basics", "Description", "Fields", "Review"] as const;

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    const fieldMessage = error.fields ? Object.values(error.fields).flat().find(Boolean) : undefined;
    return fieldMessage ?? error.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

interface WizardFormState {
  title: string;
  departmentId: string;
  roleId: string;
  jobType: JobType | "";
  salaryMin: string;
  salaryMax: string;
  description: RichTextDoc;
  descriptionPlain: string;
  customFields: CustomField[];
  wizardStep: number;
}

function jobToForm(job: Job): WizardFormState {
  return {
    title: job.title,
    departmentId: job.departmentId,
    roleId: job.roleId,
    jobType: job.jobType ?? "",
    salaryMin: job.salaryMin === null ? "" : String(job.salaryMin),
    salaryMax: job.salaryMax === null ? "" : String(job.salaryMax),
    description: job.description ?? emptyRichTextDoc(),
    descriptionPlain: job.descriptionPlain ?? "",
    customFields: job.fieldsConfig?.customFields ?? [],
    wizardStep: job.wizardStep || 1,
  };
}

function emptyForm(): WizardFormState {
  return {
    title: "",
    departmentId: "",
    roleId: "",
    jobType: "",
    salaryMin: "",
    salaryMax: "",
    description: emptyRichTextDoc(),
    descriptionPlain: "",
    customFields: [],
    wizardStep: 1,
  };
}

interface JobWizardProps {
  jobId?: string;
}

export function JobWizard({ jobId }: JobWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(emptyForm);
  const [job, setJob] = useState<Job | null>(null);
  const [seededJobId, setSeededJobId] = useState<string | null>(null);
  const [fieldEditor, setFieldEditor] = useState<CustomField | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);

  const metaQuery = useQuery({
    queryKey: queryKeys.jobRoles.list,
    queryFn: async () => {
      const [departments, roles] = await Promise.all([
        apiRequest<DepartmentResponse>("/departments"),
        apiRequest<RoleResponse>("/roles"),
      ]);
      return {
        departments: departments.data.departments,
        roles: roles.data.roles,
      };
    },
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.jobs.detail(jobId ?? ""),
    enabled: Boolean(jobId),
    queryFn: async () => apiRequest<JobResponse>(`/jobs/${jobId}`),
  });

  const loadedJob = detailQuery.data?.data.job;
  if (loadedJob && loadedJob.status === "draft" && seededJobId !== loadedJob.id) {
    setSeededJobId(loadedJob.id);
    setJob(loadedJob);
    setForm(jobToForm(loadedJob));
    setStep(Math.min(4, Math.max(1, loadedJob.wizardStep || 1)));
    setTitleTouched(true);
  }

  useEffect(() => {
    // After publish (or opening /edit on a non-draft), leave quietly — do not toast an error.
    if (!loadedJob || loadedJob.status === "draft") return;
    router.replace(`/dashboard/jobs/${loadedJob.id}`);
  }, [loadedJob, router]);

  const departments = useMemo(
    () => (metaQuery.data?.departments ?? []).filter((item) => item.status === "active" || item.id === form.departmentId),
    [metaQuery.data?.departments, form.departmentId],
  );
  const roles = useMemo(() => {
    const all = metaQuery.data?.roles ?? [];
    return all.filter(
      (role) =>
        role.departmentId === form.departmentId &&
        (role.status === "active" || role.id === form.roleId),
    );
  }, [metaQuery.data?.roles, form.departmentId, form.roleId]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { body: JobDraftPayload; existingId?: string }) => {
      if (payload.existingId) {
        return apiRequest<JobResponse>(`/jobs/${payload.existingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload.body),
        });
      }
      return apiRequest<JobResponse>("/jobs", {
        method: "POST",
        body: JSON.stringify(payload.body),
      });
    },
    onSuccess: (result) => {
      setJob(result.data.job);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      if (!jobId && result.data.job.id) {
        router.replace(`/dashboard/jobs/${result.data.job.id}/edit`);
      }
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest<JobResponse>(`/jobs/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (result) => {
      const published = result.data.job;
      queryClient.setQueryData<JobResponse>(queryKeys.jobs.detail(published.id), result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      alerts.success("Job published.");
      router.replace(`/dashboard/jobs/${published.id}`);
    },
    onError: (error) => alerts.error(errorMessage(error, "Job could not be published.")),
  });

  function buildStepPayload(nextStep: number): JobDraftPayload | null {
    if (!form.departmentId || !form.roleId) {
      alerts.error("Select a department and role.");
      return null;
    }
    if (!form.title.trim()) {
      alerts.error("Enter a job title.");
      return null;
    }

    if (nextStep > 1) {
      if (!form.jobType) {
        alerts.error("Select a job type.");
        return null;
      }
      const min = form.salaryMin === "" ? null : Number(form.salaryMin);
      const max = form.salaryMax === "" ? null : Number(form.salaryMax);
      if (min === null || max === null || Number.isNaN(min) || Number.isNaN(max)) {
        alerts.error("Enter salary min and max.");
        return null;
      }
      if (max < min) {
        alerts.error("Salary max must be greater than or equal to salary min.");
        return null;
      }
    }

    if (nextStep > 2 && !form.descriptionPlain.trim()) {
      alerts.error("Add a job description.");
      return null;
    }

    const min = form.salaryMin === "" ? null : Number(form.salaryMin);
    const max = form.salaryMax === "" ? null : Number(form.salaryMax);

    return {
      title: form.title.trim().replace(/\s+/g, " "),
      departmentId: form.departmentId,
      roleId: form.roleId,
      description: form.description,
      descriptionPlain: form.descriptionPlain,
      jobType: form.jobType || null,
      salaryMin: min !== null && !Number.isNaN(min) ? min : null,
      salaryMax: max !== null && !Number.isNaN(max) ? max : null,
      fieldsConfig: { customFields: form.customFields },
      wizardStep: nextStep,
    };
  }

  async function persist(nextStep: number, options?: { stay?: boolean; silent?: boolean }) {
    const body = buildStepPayload(nextStep);
    if (!body) return null;
    try {
      const result = await saveMutation.mutateAsync({
        body,
        existingId: job?.id ?? jobId,
      });
      setForm((current) => ({ ...current, wizardStep: nextStep }));
      if (!options?.silent) {
        alerts.success(options?.stay ? "Draft saved." : "Progress saved.");
      }
      return result.data.job;
    } catch (error) {
      alerts.error(errorMessage(error, "Draft could not be saved."));
      return null;
    }
  }

  async function goNext() {
    const nextStep = Math.min(4, step + 1);
    const saved = await persist(nextStep);
    if (saved) setStep(nextStep);
  }

  async function goBack() {
    setStep((current) => Math.max(1, current - 1));
  }

  async function saveDraft() {
    const saved = await persist(step, { stay: true });
    if (saved) router.push("/dashboard/jobs");
  }

  async function publish() {
    const saved = await persist(4, { silent: true });
    if (!saved) return;
    try {
      await publishMutation.mutateAsync(saved.id);
    } catch {
      // onError on the mutation already surfaces the alert
    }
  }

  function onDepartmentChange(value: string) {
    setForm((current) => ({
      ...current,
      departmentId: value,
      roleId: "",
      title: titleTouched ? current.title : "",
    }));
  }

  function onRoleChange(value: string) {
    const role = roles.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      roleId: value,
      title: titleTouched && current.title.trim() ? current.title : role?.name ?? current.title,
    }));
    if (!titleTouched) setTitleTouched(false);
  }

  const busy = saveMutation.isPending || publishMutation.isPending;
  const loadingExisting = Boolean(jobId) && (detailQuery.isPending || (detailQuery.isSuccess && seededJobId !== jobId));

  if (loadingExisting) {
    return (
      <div className="grid min-h-[50vh] place-items-center p-8">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  if (jobId && detailQuery.isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Draft could not be loaded.</p>
        <Link className="mt-3 inline-block text-sm font-bold text-indigo-600" href="/dashboard/jobs">
          Back to jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 py-8 text-gray-900 sm:px-6 dark:text-gray-100">
      <div className="mx-auto w-full max-w-3xl scroll-mt-8" id="job-wizard-top">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            href="/dashboard/jobs"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Jobs
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
            Step {step} of 4
          </p>
        </div>

        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-gray-950 dark:text-white">
            {jobId ? "Continue job draft" : "Create job"}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Progress is saved as a draft after each step.
          </p>
        </header>

        <ol className="mb-8 grid grid-cols-4 gap-2">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const active = number === step;
            const done = number < step;
            return (
              <li
                className={`rounded-xl border px-2 py-3 text-center text-xs font-bold ${active ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300" : done ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800"}`}
                key={label}
              >
                {label}
              </li>
            );
          })}
        </ol>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800/70">
          {step === 1 ? (
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Department <span className="text-red-500">*</span></span>
                <Dropdown
                  onChange={onDepartmentChange}
                  options={departments.map((department) => ({ value: department.id, label: department.name }))}
                  placeholder="Select department"
                  value={form.departmentId}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold">Role <span className="text-red-500">*</span></span>
                <Dropdown
                  disabled={!form.departmentId}
                  onChange={onRoleChange}
                  options={roles.map((role) => ({ value: role.id, label: role.name }))}
                  placeholder="Select role"
                  value={form.roleId}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold">Title <span className="text-red-500">*</span></span>
                <input
                  className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
                  maxLength={160}
                  onChange={(event) => {
                    setTitleTouched(true);
                    setForm((current) => ({ ...current, title: event.target.value }));
                  }}
                  placeholder="Job title"
                  value={form.title}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold">Job type <span className="text-red-500">*</span></span>
                <Dropdown
                  onChange={(next) => setForm((current) => ({ ...current, jobType: next as JobType | "" }))}
                  options={JOB_TYPES.map((type) => ({ value: type, label: type }))}
                  placeholder="Select type"
                  value={form.jobType}
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Salary min <span className="text-red-500">*</span></span>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
                    min={0}
                    onChange={(event) => setForm((current) => ({ ...current, salaryMin: event.target.value }))}
                    type="number"
                    value={form.salaryMin}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Salary max <span className="text-red-500">*</span></span>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
                    min={0}
                    onChange={(event) => setForm((current) => ({ ...current, salaryMax: event.target.value }))}
                    type="number"
                    value={form.salaryMax}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <p className="text-sm font-bold">Job description <span className="text-red-500">*</span></p>
              <RichTextEditor
                onChange={(doc, plain) =>
                  setForm((current) => ({ ...current, description: doc, descriptionPlain: plain }))
                }
                value={form.description}
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold">Application fields</h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Optional custom questions for candidates. System fields (name, email, phone, resume) are always included later.
                  </p>
                </div>
                <button
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-dashed border-indigo-300 px-4 text-sm font-bold text-indigo-600 transition hover:border-indigo-500 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                  onClick={() =>
                    setFieldEditor({
                      id: createFieldId(),
                      label: "",
                      type: "text",
                      required: false,
                      section: "personal",
                      constraint: {},
                    })
                  }
                  type="button"
                >
                  <CirclePlus className="h-4 w-4 shrink-0" />
                  Add field
                </button>
              </div>

              {form.customFields.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  No custom fields yet. You can publish without any.
                </p>
              ) : (
                <ul className="space-y-2">
                  {form.customFields.map((field) => (
                    <li
                      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/60"
                      key={field.id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{field.label}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {field.type} · {field.section}
                          {field.required ? " · required" : ""}
                        </p>
                      </div>
                      <button
                        aria-label={`Edit ${field.label}`}
                        className="icon-button"
                        onClick={() => setFieldEditor(field)}
                        type="button"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`Remove ${field.label}`}
                        className="icon-button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            customFields: current.customFields.filter((item) => item.id !== field.id),
                          }))
                        }
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/50">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-400">
                  Public preview
                </p>
                <h2 className="mt-2 text-xl font-bold text-gray-950 dark:text-white">{form.title || "Untitled job"}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {form.jobType || "Type TBD"}
                  {" · "}
                  {form.salaryMin && form.salaryMax ? `${form.salaryMin} – ${form.salaryMax}` : "Salary TBD"}
                </p>
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <RichTextViewer value={form.description} />
                </div>
                {form.customFields.length > 0 ? (
                  <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Custom application fields</p>
                    <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      {form.customFields.map((field) => (
                        <li key={field.id}>
                          {field.label} ({field.type}
                          {field.required ? ", required" : ""})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <footer className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200"
              disabled={step === 1 || busy}
              onClick={() => void goBack()}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex flex-col gap-3 sm:flex-row">
              {step === 4 ? (
                <>
                  <button
                    className="h-11 rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
                    disabled={busy}
                    onClick={() => void saveDraft()}
                    type="button"
                  >
                    {busy ? "Saving..." : "Save as draft"}
                  </button>
                  <button
                    className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void publish()}
                    type="button"
                  >
                    {publishMutation.isPending ? "Publishing..." : "Publish"}
                  </button>
                </>
              ) : (
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void goNext()}
                  type="button"
                >
                  {busy ? "Saving..." : "Next"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </footer>
        </section>
      </div>

      {fieldEditor ? (
        <FieldEditorModal
          field={fieldEditor}
          onClose={() => setFieldEditor(null)}
          onSave={(field) => {
            setForm((current) => {
              const exists = current.customFields.some((item) => item.id === field.id);
              return {
                ...current,
                customFields: exists
                  ? current.customFields.map((item) => (item.id === field.id ? field : item))
                  : [...current.customFields, field],
              };
            });
            setFieldEditor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function FieldEditorModal({
  field,
  onClose,
  onSave,
}: {
  field: CustomField;
  onClose: () => void;
  onSave: (field: CustomField) => void;
}) {
  const optionsId = useId();
  const [draft, setDraft] = useState<CustomField>(field);
  const [options, setOptions] = useState(field.constraint?.options ?? []);
  const [optionDraft, setOptionDraft] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const label = draft.label.trim().replace(/\s+/g, " ");
    if (!label) {
      alerts.error("Enter a field label.");
      return;
    }

    const constraint = { ...draft.constraint };
    if (draft.type === "text" || draft.type === "textarea") {
      if (constraint.maxLength !== undefined && constraint.maxLength < 1) {
        alerts.error("Max length must be at least 1.");
        return;
      }
    }
    if (draft.type === "number") {
      if (
        constraint.min !== undefined &&
        constraint.max !== undefined &&
        constraint.max < constraint.min
      ) {
        alerts.error("Number max must be >= min.");
        return;
      }
    }
    if (draft.type === "select") {
      const nextOptions = commitTagDraft(options, optionDraft);
      if (nextOptions.length < 1) {
        alerts.error("Add at least one select option.");
        return;
      }
      constraint.options = nextOptions;
    } else {
      delete constraint.options;
    }

    onSave({
      ...draft,
      label,
      constraint: Object.keys(constraint).length ? constraint : undefined,
    });
  }

  return (
    <Modal
      as="form"
      footer={(close) => (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold dark:border-gray-600 dark:bg-gray-800"
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button className="h-11 rounded-xl bg-indigo-600 text-sm font-bold text-white" type="submit">
            Save field
          </button>
        </div>
      )}
      maxWidth="max-w-lg"
      onClose={onClose}
      onSubmit={submit}
      title="Application field"
    >
      <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Label <span className="text-red-500">*</span></span>
            <input
              autoFocus
              className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
              maxLength={120}
              onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
              value={draft.label}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Type <span className="text-red-500">*</span></span>
            <Dropdown
              onChange={(next) => setDraft((current) => ({ ...current, type: next as CustomFieldType }))}
              options={FIELD_TYPES.map((type) => ({ value: type, label: type }))}
              value={draft.type}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Section <span className="text-red-500">*</span></span>
            <Dropdown
              onChange={(next) => setDraft((current) => ({ ...current, section: next as FieldSection }))}
              options={FIELD_SECTIONS.map((section) => ({ value: section, label: section }))}
              value={draft.section}
            />
          </label>
          <ToggleRow
            checked={draft.required}
            description="When on, candidates must complete this field before they can apply."
            onChange={(required) => setDraft((current) => ({ ...current, required }))}
            title="Required"
          />

          {draft.type === "text" || draft.type === "textarea" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Max length</span>
              <input
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
                min={1}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    constraint: {
                      ...current.constraint,
                      maxLength: event.target.value ? Number(event.target.value) : undefined,
                    },
                  }))
                }
                type="number"
                value={draft.constraint?.maxLength ?? ""}
              />
            </label>
          ) : null}

          {draft.type === "number" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Min</span>
                <input
                  className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      constraint: {
                        ...current.constraint,
                        min: event.target.value === "" ? undefined : Number(event.target.value),
                      },
                    }))
                  }
                  type="number"
                  value={draft.constraint?.min ?? ""}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Max</span>
                <input
                  className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      constraint: {
                        ...current.constraint,
                        max: event.target.value === "" ? undefined : Number(event.target.value),
                      },
                    }))
                  }
                  type="number"
                  value={draft.constraint?.max ?? ""}
                />
              </label>
            </div>
          ) : null}

          {draft.type === "select" ? (
            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor={optionsId}>
                Options <span className="text-red-500">*</span>
              </label>
              <TagInput
                draft={optionDraft}
                id={optionsId}
                onChange={setOptions}
                onDraftChange={setOptionDraft}
                placeholder="Type and press Enter"
                values={options}
              />
            </div>
          ) : null}
      </div>
    </Modal>
  );
}