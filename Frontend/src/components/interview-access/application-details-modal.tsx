"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiDownload, apiRequest } from "@/lib/api";
import type { ApplicationAnswer, ApplicationDetailResponse } from "@/lib/applications/types";
import { queryKeys } from "@/lib/query/query-keys";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatAnswerValue(answer: ApplicationAnswer) {
  if (answer.type === "checkbox") return answer.value === true ? "Yes" : "No";
  if (answer.value === null || answer.value === undefined || answer.value === "") return "—";
  return String(answer.value);
}

export function ApplicationDetailsModal({
  token,
  interviewId,
  candidateName,
  onClose,
}: {
  token: string;
  interviewId: string;
  candidateName: string;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: queryKeys.interviewAccess.application(token, interviewId),
    queryFn: async () =>
      apiRequest<ApplicationDetailResponse>(`/interview-access/${token}/interviews/${interviewId}/application`),
  });

  const application = detailQuery.data?.data.application;
  const experienceEntries = application?.experienceEntries ?? [];
  const educationEntries = application?.educationEntries ?? [];

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
    <Modal
      height="max-h-full h-[85dvh] md:h-[min(44rem,90vh)]"
      maxWidth="max-w-2xl"
      onClose={onClose}
      subtitle={application?.candidateEmail ?? "Application details"}
      title={application?.candidateName ?? candidateName}
    >
      {detailQuery.isPending ? (
        <div aria-label="Loading application" className="space-y-3" role="status">
          <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : null}
      {detailQuery.isError ? (
        <div className="py-10 text-center">
          <h3 className="text-sm font-bold">Application unavailable</h3>
          <p className="mt-1 text-xs text-gray-500">{errorMessage(detailQuery.error, "Details could not be loaded.")}</p>
          <button className="mt-3 text-sm font-bold text-indigo-600" onClick={() => void detailQuery.refetch()} type="button">
            Try again
          </button>
        </div>
      ) : null}
      {application ? (
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</dt>
              <dd className="mt-1 text-sm font-medium">{application.candidateEmail}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Phone</dt>
              <dd className="mt-1 text-sm font-medium">{application.candidatePhone}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Job</dt>
              <dd className="mt-1 text-sm font-medium">{application.roleSnapshot.title}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Department / role</dt>
              <dd className="mt-1 text-sm font-medium">
                {application.roleSnapshot.departmentName} / {application.roleSnapshot.roleName}
              </dd>
            </div>
          </dl>

          {application.answers.some((item) => item.section === "personal") ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Personal</h3>
              <dl className="mt-3 space-y-3">
                {application.answers
                  .filter((item) => item.section === "personal")
                  .map((answer) => (
                    <AnswerRow
                      answer={answer}
                      downloading={downloading}
                      key={answer.fieldId}
                      onDownload={(filename, key) =>
                        void download(
                          `/interview-access/${token}/interviews/${interviewId}/files/${answer.fieldId}`,
                          filename,
                          key,
                        )
                      }
                    />
                  ))}
              </dl>
            </section>
          ) : null}

          {experienceEntries.length > 0 || application.answers.some((item) => item.section === "experience") ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Experience</h3>
              <div className="mt-3 space-y-4">
                {experienceEntries.map((entry, index) => (
                  <div className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0 dark:border-gray-800" key={`${entry.company}-${index}`}>
                    <p className="text-sm font-bold text-gray-950 dark:text-white">
                      {entry.title} · {entry.company}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {entry.startDate}
                      {" – "}
                      {entry.endDate ?? "Present"}
                    </p>
                    {entry.description ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{entry.description}</p>
                    ) : null}
                  </div>
                ))}
                {application.answers
                  .filter((item) => item.section === "experience")
                  .map((answer) => (
                    <dl key={answer.fieldId}>
                      <AnswerRow
                        answer={answer}
                        downloading={downloading}
                        onDownload={(filename, key) =>
                          void download(
                            `/interview-access/${token}/interviews/${interviewId}/files/${answer.fieldId}`,
                            filename,
                            key,
                          )
                        }
                      />
                    </dl>
                  ))}
              </div>
            </section>
          ) : null}

          {educationEntries.length > 0 || application.answers.some((item) => item.section === "education") ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Education</h3>
              <div className="mt-3 space-y-4">
                {educationEntries.map((entry, index) => (
                  <div className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0 dark:border-gray-800" key={`${entry.school}-${index}`}>
                    <p className="text-sm font-bold text-gray-950 dark:text-white">
                      {entry.degree} · {entry.school}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {[entry.fieldOfStudy, [entry.startDate, entry.endDate].filter(Boolean).join(" – ") || null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                ))}
                {application.answers
                  .filter((item) => item.section === "education")
                  .map((answer) => (
                    <dl key={answer.fieldId}>
                      <AnswerRow
                        answer={answer}
                        downloading={downloading}
                        onDownload={(filename, key) =>
                          void download(
                            `/interview-access/${token}/interviews/${interviewId}/files/${answer.fieldId}`,
                            filename,
                            key,
                          )
                        }
                      />
                    </dl>
                  ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function AnswerRow({
  answer,
  downloading,
  onDownload,
}: {
  answer: ApplicationAnswer;
  downloading: string | null;
  onDownload: (filename: string, key: string) => void;
}) {
  return (
    <>
      <dt className="text-sm font-semibold text-gray-700 dark:text-gray-200">{answer.label}</dt>
      <dd className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {answer.type === "file" && answer.hasFile ? (
          <button
            className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
            disabled={downloading === answer.fieldId}
            onClick={() => onDownload(answer.fileName ?? "attachment", answer.fieldId)}
            type="button"
          >
            <Download aria-hidden className="h-3.5 w-3.5" />
            {downloading === answer.fieldId ? "Downloading…" : (answer.fileName ?? "Download file")}
          </button>
        ) : (
          formatAnswerValue(answer)
        )}
      </dd>
    </>
  );
}
