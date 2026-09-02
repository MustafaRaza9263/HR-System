"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
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
  resumePath,
  candidateName,
  candidateEmail,
  resumeFileName,
  onClose,
}: {
  applicationId: string;
  resumePath?: string;
  candidateName: string;
  candidateEmail: string;
  resumeFileName?: string;
  onClose: () => void;
}) {
  const path = resumePath ?? `/applications/${applicationId}/resume`;
  const resumeQuery = useQuery({
    queryKey: [...queryKeys.applications.resume(applicationId), path],
    queryFn: () => apiBlob(path),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });

  const file = resumeQuery.data;
  const filename = file?.filename || resumeFileName || "Resume";
  const previewable = Boolean(file && isPdf(file.contentType, file.filename));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    <Modal
      footer={(close) => (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-gray-500 dark:text-gray-400">{filename}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="h-10 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={close}
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
        </div>
      )}
      height="max-h-full h-[85dvh] md:h-[min(52rem,90vh)]"
      maxWidth="max-w-5xl"
      onClose={onClose}
      padded={false}
      subtitle={candidateEmail}
      title={candidateName}
    >
      <div className="h-full min-h-0 bg-gray-100 dark:bg-gray-950">
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
    </Modal>
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
