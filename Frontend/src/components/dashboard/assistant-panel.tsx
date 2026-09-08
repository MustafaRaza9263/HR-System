"use client";

import { ArrowLeft, ArrowUp, BotMessageSquare, SquarePen, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { AssistantSessionsMenu } from "@/components/dashboard/assistant-sessions-menu";
import { AssistantSteps } from "@/components/dashboard/assistant-steps";
import { AssistantTable } from "@/components/dashboard/assistant-table";
import { alerts } from "@/lib/alerts";
import { ApiClientError } from "@/lib/api";
import {
  clearAssistantSessionId,
  fetchAssistantSession,
  readAssistantSessionId,
  streamAssistantChat,
  writeAssistantSessionId,
} from "@/lib/assistant/api";
import type { AssistantChatMessage, AssistantSessionListItem } from "@/lib/assistant/types";

const COMPOSER_MAX_PX = 160;
const SESSION_STORAGE_PREFIX = "hr-assistant-";

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

function newId() {
  return `${SESSION_STORAGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function AssistantPanel({ open, onClose }: AssistantPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerId = useId();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [scrollFades, setScrollFades] = useState({ top: false, bottom: false });

  const updateScrollFades = useCallback(() => {
    const body = listRef.current;
    if (!body) return;
    const maxScroll = body.scrollHeight - body.clientHeight;
    const canScroll = maxScroll > 1;
    const next = {
      top: canScroll && body.scrollTop > 1,
      bottom: canScroll && body.scrollTop < maxScroll - 1,
    };
    setScrollFades((current) =>
      current.top === next.top && current.bottom === next.bottom ? current : next,
    );
  }, []);

  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const stored = readAssistantSessionId();
    if (!stored) return;
    let cancelled = false;
    void fetchAssistantSession(stored)
      .then((session) => {
        if (cancelled) return;
        setSessionId(session.id);
        setMessages(session.messages);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiClientError && error.status === 404) {
          clearAssistantSessionId();
          return;
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [draft]);

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    updateScrollFades();
  }, [messages, sending, updateScrollFades]);

  useEffect(() => {
    const body = listRef.current;
    if (!body) return;
    const mutation = new MutationObserver(updateScrollFades);
    const resize = new ResizeObserver(updateScrollFades);
    body.addEventListener("scroll", updateScrollFades, { passive: true });
    mutation.observe(body, { childList: true, subtree: true, characterData: true });
    resize.observe(body);
    window.addEventListener("resize", updateScrollFades);
    updateScrollFades();
    return () => {
      body.removeEventListener("scroll", updateScrollFades);
      mutation.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", updateScrollFades);
    };
  }, [updateScrollFades, messages.length]);

  const canSend = !sending && draft.trim().length > 0;

  function resetConversation() {
    if (sending) return;
    clearAssistantSessionId();
    setSessionId(null);
    setMessages([]);
    setDraft("");
  }

  async function openSession(item: AssistantSessionListItem) {
    if (sending || item.id === sessionId) return;
    try {
      const session = await fetchAssistantSession(item.id);
      setSessionId(session.id);
      setMessages(session.messages);
      writeAssistantSessionId(session.id);
    } catch {
      alerts.error("That conversation could not be loaded.", { title: "Assistant", dedupeKey: "assistant-session-load" });
    }
  }

  function handleSessionDeleted(id: string) {
    if (id !== sessionId) return;
    resetConversation();
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const userMessage: AssistantChatMessage = {
      id: newId(),
      role: "user",
      content: text,
      steps: [],
      table: null,
      createdAt: new Date().toISOString(),
    };
    const assistantMessage: AssistantChatMessage = {
      id: newId(),
      role: "assistant",
      content: "",
      steps: [],
      table: null,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setDraft("");
    setSending(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      await streamAssistantChat({ message: text, ...(sessionId ? { sessionId } : {}) }, (eventItem) => {
        if (eventItem.event === "session") {
          setSessionId(eventItem.data.id);
          writeAssistantSessionId(eventItem.data.id);
          return;
        }
        setMessages((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (!last || last.role !== "assistant") return current;
          if (eventItem.event === "step_start") {
            next[next.length - 1] = {
              ...last,
              steps: [...last.steps, { id: eventItem.data.id, label: eventItem.data.label, status: "running" }],
            };
          } else if (eventItem.event === "step_done") {
            next[next.length - 1] = {
              ...last,
              steps: last.steps.map((step) =>
                step.id === eventItem.data.id ? { ...step, status: "done" } : step,
              ),
            };
          } else if (eventItem.event === "table") {
            next[next.length - 1] = { ...last, table: eventItem.data };
          } else if (eventItem.event === "answer") {
            next[next.length - 1] = {
              ...last,
              content: eventItem.data.text,
              pending: false,
              steps: last.steps.map((step) => ({ ...step, status: "done" })),
            };
          } else if (eventItem.event === "error") {
            next[next.length - 1] = {
              ...last,
              content: eventItem.data.message,
              pending: false,
            };
          } else if (eventItem.event === "done") {
            next[next.length - 1] = { ...last, pending: false };
          }
          return next;
        });
        if (eventItem.event === "done" && eventItem.data.sessionId) {
          setSessionId(eventItem.data.sessionId);
          writeAssistantSessionId(eventItem.data.sessionId);
        }
      });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "The assistant could not complete that request.";
      setMessages((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, content: message, pending: false };
        }
        return next;
      });
      alerts.error(message, { title: "Assistant", dedupeKey: "assistant-error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <aside
      aria-hidden={!open}
      aria-label="Assistant"
      className={`overflow-hidden outline-none transition-[width,transform] duration-300 ease-in-out motion-reduce:transition-none max-md:fixed max-md:inset-0 max-md:z-60 max-md:w-full md:relative md:z-auto md:h-svh md:shrink-0 ${
        open
          ? "translate-x-0 md:w-[min(24rem,86vw)]"
          : "pointer-events-none translate-x-full md:pointer-events-auto md:translate-x-0 md:w-0"
      }`}
      id="hr-assistant-panel"
      inert={!open ? true : undefined}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="flex h-full w-full flex-col bg-white md:w-[min(24rem,86vw)] md:border-l md:border-gray-200 dark:bg-gray-950 dark:md:border-gray-800/60">
        <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 px-4 dark:border-gray-800/60">
          <button
            aria-label="Back"
            className="hr-header-icon relative z-10 grid md:hidden"
            onClick={onClose}
            type="button"
          >
            <ArrowLeft aria-hidden className="h-5 w-5" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-gray-950 dark:text-white">
            Assistant
          </h2>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <AssistantSessionsMenu
              currentId={sessionId}
              disabled={sending}
              onDeleted={handleSessionDeleted}
              onSelect={(item) => void openSession(item)}
            />
            <button
              aria-label="New conversation"
              className="icon-button"
              disabled={sending}
              onClick={resetConversation}
              type="button"
            >
              <SquarePen aria-hidden className="h-4 w-4" />
            </button>
            <button
              aria-label="Close assistant"
              className="icon-button hidden md:grid"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-linear-to-b from-white to-transparent transition-opacity duration-200 dark:from-gray-950 ${
              scrollFades.top ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t from-white to-transparent transition-opacity duration-200 dark:from-gray-950 ${
              scrollFades.bottom ? "opacity-100" : "opacity-0"
            }`}
          />
          <div className="hr-hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4" ref={listRef}>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-2 text-center">
              <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <BotMessageSquare aria-hidden className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">HR Assistant</p>
              <p className="mt-1 max-w-60 text-xs text-gray-500 dark:text-gray-400">
                Ask about jobs, applications, interviews, or today’s hiring numbers.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((message) => (
                <article className="min-w-0" key={message.id}>
                  {message.role === "user" ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
                        You
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-950 dark:text-white">
                        {message.content}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {message.pending && message.steps.length === 0 ? (
                        <p className="apply-autofill-shimmer text-xs font-medium text-gray-700 dark:text-gray-200">
                          Looking that up…
                        </p>
                      ) : (
                        <AssistantSteps collapsed={!message.pending && Boolean(message.content)} steps={message.steps} />
                      )}
                      {message.table ? <AssistantTable table={message.table} /> : null}
                      {paragraphs(message.content).map((part, index) => (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200" key={`${message.id}-p-${String(index)}`}>
                          {part}
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          </div>
        </div>

        <form
          className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-gray-700 dark:bg-gray-800/70"
          onSubmit={(event) => void send(event)}
        >
          <div className="relative rounded-2xl border border-gray-200 bg-white focus-within:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:focus-within:border-indigo-500">
            <label className="sr-only" htmlFor={composerId}>
              Message the assistant
            </label>
            <textarea
              className="hr-hide-scrollbar max-h-40 min-h-18 w-full resize-none overflow-y-auto bg-transparent px-4 pb-12 pt-3 text-sm leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed dark:text-white dark:placeholder:text-gray-500"
              disabled={sending}
              id={composerId}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || !canSend) return;
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
              placeholder="Ask about candidates, jobs, or interviews…"
              ref={textareaRef}
              rows={2}
              value={draft}
            />
            <button
              aria-label="Send message"
              className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-600/40 disabled:text-white/80"
              disabled={!canSend}
              type="submit"
            >
              <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
