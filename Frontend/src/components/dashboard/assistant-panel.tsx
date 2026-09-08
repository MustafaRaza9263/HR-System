"use client";

import { ArrowUp, BotMessageSquare, X } from "lucide-react";
import { useEffect, useRef } from "react";

const PANEL_WIDTH = "w-[min(24rem,86vw)]";

interface AssistantToggleProps {
  open: boolean;
  onToggle: () => void;
}

export function AssistantToggle({ open, onToggle }: AssistantToggleProps) {
  return (
    <button
      aria-controls="hr-assistant-panel"
      aria-expanded={open}
      aria-label={open ? "Close assistant" : "Open assistant"}
      className="hr-header-icon relative grid"
      data-active={open ? "true" : undefined}
      onClick={onToggle}
      type="button"
    >
      <BotMessageSquare aria-hidden className="h-5 w-5" />
    </button>
  );
}

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AssistantPanel({ open, onClose }: AssistantPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <aside
      aria-hidden={!open}
      aria-label="Assistant"
      className={`relative h-svh shrink-0 overflow-hidden outline-none transition-[width] duration-300 ease-in-out motion-reduce:transition-none ${
        open ? PANEL_WIDTH : "w-0"
      }`}
      id="hr-assistant-panel"
      inert={!open ? true : undefined}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className={`flex h-full ${PANEL_WIDTH} flex-col border-l border-gray-200 bg-white dark:border-gray-800/60 dark:bg-gray-950`}>
        <div className="relative h-16 shrink-0 border-b border-gray-200 dark:border-gray-800/60">
          <h2 className="absolute left-6 top-1/2 -translate-y-1/2 text-lg font-bold tracking-tight text-gray-950 dark:text-white">
            Assistant
          </h2>
          <button
            aria-label="Close assistant"
            className="icon-button absolute right-4 top-1/2 -translate-y-1/2"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <BotMessageSquare aria-hidden className="h-6 w-6" />
          </span>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">HR Assistant</p>
          <p className="mt-1 max-w-60 text-xs text-gray-500 dark:text-gray-400">
            Ask about jobs, applications, and interviews. Chat is coming soon.
          </p>
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-gray-700 dark:bg-gray-800/70">
          <div className="relative rounded-2xl border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-900">
            <label className="sr-only" htmlFor="hr-assistant-composer">
              Message the assistant
            </label>
            <textarea
              className="hr-hide-scrollbar max-h-40 min-h-18 w-full resize-none overflow-y-auto bg-transparent px-4 pb-12 pt-3 text-sm leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed dark:text-white dark:placeholder:text-gray-500"
              disabled
              id="hr-assistant-composer"
              placeholder="Ask about candidates, jobs, or interviews…"
              rows={2}
            />
            <button
              aria-label="Send message"
              className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-indigo-600 text-white shadow-sm disabled:cursor-not-allowed disabled:bg-indigo-600/40 disabled:text-white/80"
              disabled
              type="button"
            >
              <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
