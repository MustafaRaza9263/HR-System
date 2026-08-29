export type AlertTone = "success" | "error" | "warning" | "info";

export interface AlertAction {
  label: string;
  onClick: () => void;
}

export interface AppAlert {
  id: string;
  tone: AlertTone;
  message: string;
  title?: string;
  duration: number;
  dedupeKey?: string;
  action?: AlertAction;
}

export interface AlertOptions {
  title?: string;
  duration?: number;
  dedupeKey?: string;
  action?: AlertAction;
}

type AlertListener = (alert: AppAlert) => void;

const listeners = new Set<AlertListener>();
const alertedErrors = new WeakSet<object>();

function createAlertId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function subscribeToAlerts(listener: AlertListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishAlert(
  tone: AlertTone,
  message: string,
  options: AlertOptions = {},
) {
  const cleanMessage = message.trim();
  if (!cleanMessage || typeof window === "undefined") return;

  const alert: AppAlert = {
    id: createAlertId(),
    tone,
    message: cleanMessage,
    title: options.title,
    duration: options.duration ?? (tone === "error" ? 7_000 : 4_200),
    dedupeKey: options.dedupeKey ?? `${tone}:${cleanMessage}`,
    action: options.action,
  };

  listeners.forEach((listener) => listener(alert));
}

export function extractAlertMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;

  const body = payload as Record<string, unknown>;
  if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  if (typeof body.error === "string" && body.error.trim()) return body.error.trim();

  if (Array.isArray(body.errors)) {
    const messages = body.errors
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return "";

        const entry = item as Record<string, unknown>;
        if (typeof entry.message === "string") return entry.message;
        if (typeof entry.msg === "string") return entry.msg;
        return "";
      })
      .filter(Boolean);

    if (messages.length) return messages.join(" ");
  }

  return fallback;
}

export function wasAlerted(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && alertedErrors.has(error));
}

export function markAlerted(error: unknown) {
  if (error && typeof error === "object") alertedErrors.add(error);
}

function getLocalErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";

  const message = String((error as { message?: string }).message ?? "").trim();
  if (!message || /^Request failed with status code \d+$/i.test(message)) return "";
  if (/^internal server error$/i.test(message)) return "";
  return message;
}

export const alerts = {
  success: (message: string, options?: AlertOptions) =>
    publishAlert("success", message, options),
  error: (message: string, options?: AlertOptions) =>
    publishAlert("error", message, options),
  warning: (message: string, options?: AlertOptions) =>
    publishAlert("warning", message, options),
  info: (message: string, options?: AlertOptions) =>
    publishAlert("info", message, options),
  fromError: (error: unknown, fallback: string, options?: AlertOptions) => {
    if (wasAlerted(error)) return;

    const payload =
      error && typeof error === "object"
        ? (error as { response?: { data?: unknown } }).response?.data
        : undefined;
    const message =
      extractAlertMessage(payload, "") || getLocalErrorMessage(error) || fallback;

    publishAlert("error", message, options);
    markAlerted(error);
  },
};
