"use client";

import { CircleCheck, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";

import { ALLOWED_UPLOAD_ACCEPT, MAX_UPLOAD_BYTES } from "@/lib/applications/types";
import { validateUploadFile } from "@/lib/applications/validate";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function FileUploader({
  file,
  onChange,
  disabled = false,
  accept = ALLOWED_UPLOAD_ACCEPT,
  hint = `PDF or Word, up to ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`,
  label,
  id,
  invalid = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  accept?: string;
  hint?: string;
  label: string;
  id?: string;
  invalid?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef(0);
  const cancelledRef = useRef(false);
  const dragCountRef = useRef(0);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const phase = uploading ? "uploading" : file ? "success" : "idle";

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function stopAnimation() {
    cancelledRef.current = true;
    cancelAnimationFrame(frameRef.current);
  }

  function beginUpload(next: File) {
    const message = validateUploadFile(next, label, false);
    if (message) {
      setLocalError(message);
      return;
    }

    stopAnimation();
    cancelledRef.current = false;
    setLocalError(null);
    setUploading(true);
    setProgress(0);
    onChange(next);

    const start = performance.now();
    const duration = 650;

    const tick = (now: number) => {
      if (cancelledRef.current) return;
      const t = Math.min(1, (now - start) / duration);
      setProgress(Math.round((1 - (1 - t) ** 3) * 100));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      setProgress(100);
      setUploading(false);
    };

    frameRef.current = requestAnimationFrame(tick);
  }

  function openPicker() {
    if (disabled || phase !== "idle") return;
    inputRef.current?.click();
  }

  function clear() {
    stopAnimation();
    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
    setProgress(0);
    setLocalError(null);
    onChange(null);
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled || phase !== "idle") return;
    dragCountRef.current += 1;
    setDragOver(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function onDragLeave() {
    dragCountRef.current -= 1;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setDragOver(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragCountRef.current = 0;
    setDragOver(false);
    if (disabled || phase !== "idle") return;
    const next = event.dataTransfer.files[0];
    if (next) beginUpload(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  const interactive = !disabled && phase === "idle";

  return (
    <div>
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        id={inputId}
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) beginUpload(next);
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />

      {phase === "success" && file ? (
        <div
          className="flex items-center justify-between gap-3 rounded border border-emerald-200 bg-emerald-50 px-3.5 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          role="status"
        >
          <div className="flex min-w-0 items-center gap-3">
            <CircleCheck className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-800 dark:text-white">{file.name}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            disabled={disabled}
            onClick={clear}
            type="button"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          aria-busy={phase === "uploading"}
          aria-disabled={disabled}
          aria-invalid={invalid || Boolean(localError)}
          aria-label={phase === "uploading" ? `Uploading ${label}` : `Upload ${label}`}
          className={[
            "flex min-h-30 flex-col items-center justify-center rounded border border-dashed px-4 py-6 transition",
            dragOver
              ? "border-indigo-500 bg-indigo-50/70 dark:border-indigo-400 dark:bg-indigo-500/10"
              : invalid || localError
                ? "border-red-400 bg-red-50/40 dark:border-red-500/50 dark:bg-red-500/5"
                : "border-neutral-300 dark:border-gray-700",
            interactive
              ? "cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/5"
              : "cursor-default",
            disabled ? "opacity-60" : "",
          ].join(" ")}
          onClick={openPicker}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onKeyDown={onKeyDown}
          role="button"
          tabIndex={interactive ? 0 : -1}
        >
          {phase === "uploading" ? (
            <div className="w-full max-w-sm" role="status">
              <div className="mb-2 flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-300">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-[width] duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload className="mb-3 h-8 w-8 text-neutral-400" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Drag and drop or <span className="font-semibold text-indigo-600 dark:text-indigo-400">Browse</span>
              </p>
              <p className="mt-1 text-xs text-neutral-400">{hint}</p>
            </>
          )}
        </div>
      )}

      {localError ? <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{localError}</p> : null}
    </div>
  );
}
