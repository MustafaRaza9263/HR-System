"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { ApplicationStatusTimeline, applicationStatusLabel, applicationStatusTone } from "@/components/applications/application-status-timeline";
import { StatusPills } from "@/components/ui/status-pills";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiDownload } from "@/lib/api";
import type { ApplicationAnswer, ApplicationDetail, EducationEntry, ExperienceEntry } from "@/lib/applications/types";
import { formatCalendarDate } from "@/lib/interviews/format";
import type { FieldSection } from "@/lib/jobs/types";

const CARD =
  "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800/70";
const CARD_TIGHT =
  "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/70";

const SECTION_ORDER: FieldSection[] = ["personal", "experience", "education"];
const SECTION_LABEL: Record<FieldSection, string> = {
  personal: "Personal",
  experience: "Experience",
  education: "Education",
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatSalaryAmount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatDateOnly(value: string | null | undefined, pattern = "MMM d, yyyy") {
  if (!value) return "—";
  return formatCalendarDate(value, pattern);
}

function experienceRange(entry: ExperienceEntry) {
  const start = formatCalendarDate(entry.startDate, "MMM yyyy");
  const end = entry.currentlyWorking || !entry.endDate ? "Present" : formatCalendarDate(entry.endDate, "MMM yyyy");
  return `${start} – ${end}`;
}

function educationRange(entry: EducationEntry) {
  const start = entry.startDate ? formatCalendarDate(entry.startDate, "yyyy") : null;
  const end = entry.endDate ? formatCalendarDate(entry.endDate, "yyyy") : null;
  if (start && end) return `${start} – ${end}`;
  return start || end || null;
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function formatAnswerValue(answer: ApplicationAnswer): string {
  if (answer.type === "checkbox") return answer.value === true ? "Yes" : "No";
  if (answer.value === null || answer.value === undefined || answer.value === "") return "—";
  if (answer.type === "date" && typeof answer.value === "string") return formatCalendarDate(answer.value, "MMM d, yyyy");
  return String(answer.value);
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-950 dark:text-white">{children}</dd>
    </div>
  );
}

function CardTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold tracking-[-0.01em] text-gray-950 dark:text-white">{children}</h2>
      {typeof count === "number" ? (
        <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-400 dark:bg-gray-900 dark:text-gray-500">
          {count}
        </span>
      ) : null}
    </div>
  );
}

export function ApplicationProfile({ application }: { application: ApplicationDetail }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const experienceEntries = application.experienceEntries ?? [];
  const educationEntries = application.educationEntries ?? [];

  const answersBySection = useMemo(() => {
    const groups: Record<FieldSection, ApplicationAnswer[]> = { personal: [], experience: [], education: [] };
    for (const answer of application.answers) {
      groups[answer.section]?.push(answer);
    }
    return groups;
  }, [application.answers]);

  const hasCustomAnswers = application.answers.length > 0;

  async function download(path: string, filename: string, key: string) {
    setDownloading(key);
    try {
      await apiDownload(path, filename);
    } catch (error) {
      alerts.error(errorMessage(error, "File could not be downloaded."));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <article className={CARD}>
          <CardTitle>Personal Details</CardTitle>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Full name">{application.candidateName}</Fact>
            <Fact label="Email">
              <a className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400" href={`mailto:${application.candidateEmail}`}>
                {application.candidateEmail}
              </a>
            </Fact>
            <Fact label="Phone">
              <a className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400" href={`tel:${application.candidatePhone}`}>
                {application.candidatePhone}
              </a>
            </Fact>
            <Fact label="Alt. phone">
              {application.candidateAlternativePhone ? (
                <a
                  className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                  href={`tel:${application.candidateAlternativePhone}`}
                >
                  {application.candidateAlternativePhone}
                </a>
              ) : (
                "—"
              )}
            </Fact>
            <Fact label="Date of birth">{formatDateOnly(application.candidateDateOfBirth)}</Fact>
            <Fact label="CNIC">{application.candidateCnic || "—"}</Fact>
            <Fact label="Marital status">{application.candidateMaritalStatus || "—"}</Fact>
          </dl>
        </article>

        {experienceEntries.length > 0 ? (
          <article className={CARD}>
            <CardTitle count={experienceEntries.length}>Experience</CardTitle>
            <ol className="flex flex-col gap-4">
              {experienceEntries.map((entry, index) => (
                <li className="flex gap-3.5" key={`${entry.company}-${entry.title}-${index}`}>
                  <span
                    aria-hidden
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-500/20"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-sm font-semibold text-gray-950 dark:text-white">{entry.title}</p>
                      <p className="whitespace-nowrap text-[13px] font-medium text-gray-400">{experienceRange(entry)}</p>
                    </div>
                    <p className="mt-0.5 text-[13px] text-gray-500">{entry.company}</p>
                    {typeof entry.salary === "number" ? (
                      <p className="mt-1 text-[13px] text-gray-400">Salary: {formatSalaryAmount(entry.salary)}</p>
                    ) : null}
                    {entry.description ? (
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-500">{entry.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </article>
        ) : null}

        {educationEntries.length > 0 ? (
          <article className={CARD}>
            <CardTitle count={educationEntries.length}>Education</CardTitle>
            <ol className="flex flex-col gap-4">
              {educationEntries.map((entry, index) => {
                const range = educationRange(entry);
                return (
                  <li className="flex gap-3.5" key={`${entry.school}-${entry.degree}-${index}`}>
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-500/20"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-sm font-semibold text-gray-950 dark:text-white">{entry.degree}</p>
                        {range ? <p className="whitespace-nowrap text-[13px] font-medium text-gray-400">{range}</p> : null}
                      </div>
                      <p className="mt-0.5 text-[13px] text-gray-500">{entry.school}</p>
                      {entry.fieldOfStudy || entry.cgpaPercentage ? (
                        <p className="mt-1 text-[13px] text-gray-400">
                          {[entry.fieldOfStudy || null, entry.cgpaPercentage ? `CGPA: ${entry.cgpaPercentage}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        ) : null}

        {hasCustomAnswers ? (
          <article className={CARD}>
            <CardTitle>Additional Questions</CardTitle>
            <div className="flex flex-col">
              {SECTION_ORDER.map((section) => {
                const answers = answersBySection[section];
                if (answers.length === 0) return null;
                return (
                  <div
                    className="border-t border-gray-100 py-4 first:border-t-0 first:pt-0 last:pb-0 dark:border-gray-800"
                    key={section}
                  >
                    <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-gray-400">
                      {SECTION_LABEL[section]}
                    </h3>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      {answers.map((answer) => (
                        <AnswerFact
                          answer={answer}
                          applicationId={application.id}
                          downloading={downloading}
                          key={answer.fieldId}
                          onDownload={(path, filename, key) => void download(path, filename, key)}
                        />
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          </article>
        ) : null}

        <article className={CARD}>
          <CardTitle>AI scoring</CardTitle>
          {application.aiScore === null && !application.aiSummary ? (
            <p className="text-sm text-gray-500">Not scored yet</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">Score: </span>
                {application.aiScore === null ? "Not scored yet" : application.aiScore}
              </p>
              {application.aiSummary ? (
                <p className="text-gray-600 dark:text-gray-300">{application.aiSummary}</p>
              ) : null}
            </div>
          )}
        </article>
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
        <article className={CARD_TIGHT}>
          <CardTitle>Snapshot</CardTitle>
          <dl className="flex flex-col gap-3">
            <Fact label="Job">
              <Link className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400" href={`/dashboard/jobs/${application.jobId}`}>
                {application.roleSnapshot.title}
              </Link>
            </Fact>
            <Fact label="Department">{application.roleSnapshot.departmentName}</Fact>
            <Fact label="Role">{application.roleSnapshot.roleName}</Fact>
            <Fact label="Status">
              <StatusPills
                items={[{ label: applicationStatusLabel(application.status), tone: applicationStatusTone(application.status) }]}
              />
            </Fact>
          </dl>
        </article>

        {(application.statusHistory ?? []).length > 0 ? (
          <article className={CARD_TIGHT}>
            <CardTitle>Timeline</CardTitle>
            <ApplicationStatusTimeline history={application.statusHistory} />
          </article>
        ) : null}
      </aside>
    </div>
  );
}

function AnswerFact({
  answer,
  applicationId,
  downloading,
  onDownload,
}: {
  answer: ApplicationAnswer;
  applicationId: string;
  downloading: string | null;
  onDownload: (path: string, filename: string, key: string) => void;
}) {
  const display = formatAnswerValue(answer);
  const linkable = answer.type === "text" && typeof answer.value === "string" && isHttpUrl(answer.value);
  const spanFile = answer.type === "file";

  return (
    <div className={spanFile ? "sm:col-span-2" : undefined}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{answer.label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-950 dark:text-white">
        {answer.type === "file" && answer.hasFile ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[13px] font-semibold text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-indigo-400 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
            disabled={downloading === answer.fieldId}
            onClick={() =>
              onDownload(`/applications/${applicationId}/files/${answer.fieldId}`, answer.fileName ?? "attachment", answer.fieldId)
            }
            type="button"
          >
            <Download aria-hidden className="h-3.5 w-3.5" />
            {downloading === answer.fieldId ? "Downloading…" : (answer.fileName ?? "Download file")}
          </button>
        ) : linkable ? (
          <a
            className="break-all hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
            href={String(answer.value)}
            rel="noopener noreferrer"
            target="_blank"
          >
            {display}
          </a>
        ) : (
          <span className="whitespace-pre-wrap">{display}</span>
        )}
      </dd>
    </div>
  );
}
