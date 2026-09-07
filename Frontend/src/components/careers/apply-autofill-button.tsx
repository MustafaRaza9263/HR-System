"use client";

import { useEffect, useId, useRef, useState } from "react";

import { alerts } from "@/lib/alerts";
import { ALLOWED_UPLOAD_ACCEPT } from "@/lib/applications/types";
import { validateUploadFile } from "@/lib/applications/validate";

const PHASES = [
  "Extracting data",
  "Processing content",
  "Analyzing fields",
  "Auto-filling form",
  "Verifying entries",
] as const;

const IDLE_TEXT = "Autofill my application";
const SUCCESS_TEXT = "All done — ready!";
const FAILURE_TEXT = "Something went wrong";
const PHASE_MS = 800;
const RESET_MS = 2800;

type ButtonStatus = "idle" | "running" | "success" | "failure";

export function ApplyAutofillButton({
  disabled = false,
  onFile,
}: {
  disabled?: boolean;
  onFile: (file: File) => Promise<boolean>;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<number>(0);
  const [status, setStatus] = useState<ButtonStatus>("idle");
  const [phaseIndex, setPhaseIndex] = useState(0);

  const running = status === "running";
  const label =
    status === "running"
      ? (PHASES[phaseIndex] ?? PHASES[0])
      : status === "success"
        ? SUCCESS_TEXT
        : status === "failure"
          ? FAILURE_TEXT
          : IDLE_TEXT;

  useEffect(() => {
    return () => {
      window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1 < PHASES.length ? current + 1 : current));
    }, PHASE_MS);
    return () => window.clearInterval(timer);
  }, [status]);

  function finish(ok: boolean) {
    setStatus(ok ? "success" : "failure");
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      setStatus("idle");
      setPhaseIndex(0);
    }, RESET_MS);
  }

  async function handleFile(file: File | undefined) {
    if (!file || running) return;
    const localError = validateUploadFile(file, "Resume", true);
    if (localError) {
      alerts.error(localError);
      return;
    }

    setStatus("running");
    setPhaseIndex(0);
    try {
      const ok = await onFile(file);
      finish(ok);
    } catch {
      finish(false);
    }
  }

  return (
    <div className="relative w-full shrink-0 sm:w-auto">
      <button
        aria-busy={running}
        aria-live="polite"
        className="apply-autofill-btn relative flex min-h-12 w-full cursor-pointer items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] border-neutral-900 bg-transparent px-5 py-3 text-[15px] font-medium tracking-[0.3px] text-neutral-900 transition duration-300 select-none hover:bg-black/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-90 disabled:hover:bg-transparent sm:min-h-14 sm:w-auto sm:min-w-60 dark:border-white dark:text-white dark:hover:bg-white/4 dark:focus-visible:ring-white/40 dark:disabled:hover:bg-transparent"
        disabled={disabled || running}
        onClick={() => {
          if (disabled || running) return;
          inputRef.current?.click();
        }}
        type="button"
      >
        <span className="apply-autofill-text block w-full text-center leading-snug" key={label}>
          <span className={running ? "apply-autofill-shimmer" : undefined}>{label}</span>
        </span>
      </button>
      <input
        accept={ALLOWED_UPLOAD_ACCEPT}
        className="sr-only"
        disabled={disabled || running}
        id={inputId}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void handleFile(file);
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
    </div>
  );
}
