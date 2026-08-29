"use client";

import { Check, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { type AppAlert, subscribeToAlerts } from "@/lib/alerts";

const toneConfig = {
  success: { icon: Check, title: "Success" },
  error: { icon: CircleAlert, title: "Action failed" },
  warning: { icon: TriangleAlert, title: "Needs attention" },
  info: { icon: Info, title: "Update" },
} as const;

export function AlertProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AppAlert[]>([]);
  const timers = useRef(new Map<string, number>());
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    return subscribeToAlerts((next) => {
      setItems((current) => {
        const filtered = next.dedupeKey
          ? current.filter(
              (item) =>
                item.dedupeKey !== next.dedupeKey && item.message !== next.message,
            )
          : current;

        return [...filtered, next].slice(-4);
      });

      if (next.duration > 0) {
        const timer = window.setTimeout(() => dismiss(next.id), next.duration);
        timers.current.set(next.id, timer);
      }
    });
  }, [dismiss]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const viewport = mounted
    ? createPortal(
        <div
          aria-atomic="false"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-0 z-[10050] flex flex-col gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:left-auto sm:right-4 sm:top-3 sm:w-[min(390px,calc(100vw-1.5rem))] sm:px-0 sm:pt-0"
        >
          {items.map((item) => {
            const config = toneConfig[item.tone];
            const Icon = config.icon;

            return (
              <section
                className="app-alert app-alert-enter pointer-events-auto"
                data-tone={item.tone}
                key={item.id}
                role={item.tone === "error" ? "alert" : "status"}
              >
                <div className="flex items-start gap-3 p-3 pr-2.5">
                  <div className={`app-alert__icon app-alert__icon--${item.tone}`}>
                    <Icon aria-hidden className="h-[17px] w-[17px]" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1 pt-px">
                    <p className="app-alert__title">{item.title ?? config.title}</p>
                    <p className="app-alert__message">{item.message}</p>
                    {item.action ? (
                      <button
                        className="app-alert__action focus:outline-none"
                        onClick={() => {
                          item.action?.onClick();
                          dismiss(item.id);
                        }}
                        type="button"
                      >
                        {item.action.label}
                      </button>
                    ) : null}
                  </div>
                  <button
                    aria-label="Dismiss notification"
                    className="app-alert__dismiss -mr-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    onClick={() => dismiss(item.id)}
                    type="button"
                  >
                    <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </div>
                {item.duration > 0 ? (
                  <div aria-hidden className="app-alert__progress">
                    <div
                      className="app-alert__progress-bar app-alert-progress"
                      style={{ animationDuration: `${item.duration}ms` }}
                    />
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {children}
      {viewport}
    </>
  );
}
