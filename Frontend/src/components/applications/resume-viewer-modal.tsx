"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";

import { UserProfile } from "@/components/ui/user-profile";
import { ApiClientError, apiBlob } from "@/lib/api";
import { queryKeys } from "@/lib/query/query-keys";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

function isPdf(contentType: string, filename: string) {
  return contentType.includes("pdf") || filename.toLowerCase().endsWith(".pdf");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ResumeViewerModal({
  applicationId,
  candidateName,
  candidateEmail,
  resumeFileName,
  onClose,
}: {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  resumeFileName?: string;
  onClose: () => void;
}) {
  const resumeQuery = useQuery({
    queryKey: queryKeys.applications.resume(applicationId),
    queryFn: () => apiBlob(`/applications/${applicationId}/resume`),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });

  const file = resumeQuery.data;
  const filename = file?.filename || resumeFileName || "Resume";
  const previewable = Boolean(file && isPdf(file.contentType, file.filename));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (!file || !previewable) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, previewable]);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-labelledby="resume-viewer-title"
        aria-modal="true"
        className="flex h-[min(52rem,calc(100svh-3rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 sm:px-5 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="sr-only" id="resume-viewer-title">
              Resume for {candidateName}
            </h2>
            <UserProfile email={candidateEmail} name={candidateName} />
          </div>
          <button aria-label="Close modal" className="icon-button" onClick={onClose} type="button">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 bg-gray-100 dark:bg-gray-950">
          {resumeQuery.isPending || (previewable && !previewUrl) ? <DocumentLoading /> : null}
          {resumeQuery.isError ? (
            <DocumentMessage
              actionLabel="Try again"
              description={errorMessage(resumeQuery.error, "Resume could not be loaded.")}
              onAction={() => void resumeQuery.refetch()}
              title="Resume unavailable"
            />
          ) : null}
          {file && !previewable ? (
            <DocumentMessage
              actionLabel="Download resume"
              description="Word documents cannot be previewed in the browser. Download the file to open it."
              onAction={() => downloadBlob(file.blob, filename)}
              title={filename}
            />
          ) : null}
          {previewUrl ? (
            <iframe
              className="h-full w-full border-0 bg-gray-100 dark:bg-gray-950"
              src={`${previewUrl}#view=FitH`}
              title={`Resume for ${candidateName}`}
            />
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-5 dark:border-gray-700 dark:bg-gray-800/70">
          <p className="min-w-0 truncate text-sm text-gray-500 dark:text-gray-400">{filename}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="h-10 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={!file}
              onClick={() => {
                if (file) downloadBlob(file.blob, filename);
              }}
              type="button"
            >
              <Download aria-hidden className="h-4 w-4" />
              Download
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function DocumentLoading() {
  return (
    <div aria-label="Loading resume" className="grid h-full place-items-center p-6" role="status">
      <div className="h-full max-h-[44rem] w-full max-w-[46rem] animate-pulse rounded-sm bg-white shadow-sm dark:bg-gray-800" />
    </div>
  );
}

function DocumentMessage({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <FileText aria-hidden className="mx-auto h-9 w-9 text-gray-400" />
        <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">{description}</p>
        <button className="mt-4 text-sm font-bold text-indigo-600 dark:text-indigo-400" onClick={onAction} type="button">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
