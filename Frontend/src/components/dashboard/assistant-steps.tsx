"use client";

import { Check } from "lucide-react";

import type { AssistantStep } from "@/lib/assistant/types";

export function AssistantSteps({ steps, collapsed }: { steps: AssistantStep[]; collapsed?: boolean }) {
  if (steps.length === 0) return null;

  const list = (
    <ol className="flex flex-col gap-2">
      {steps.map((step) => {
        const running = step.status === "running";
        return (
          <li className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400" key={step.id}>
            {running ? (
              <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full border border-indigo-300 dark:border-indigo-500/50" />
            ) : (
              <span className="grid h-3.5 w-3.5 shrink-0 place-items-center text-indigo-600 dark:text-indigo-400">
                <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} />
              </span>
            )}
            <span className={running ? "apply-autofill-shimmer font-medium text-gray-700 dark:text-gray-200" : ""}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );

  if (!collapsed) return list;

  return (
    <details className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/40">
      <summary className="cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400">
        {steps.length === 1 ? "1 check" : `${String(steps.length)} checks`}
      </summary>
      <div className="mt-2">{list}</div>
    </details>
  );
}
