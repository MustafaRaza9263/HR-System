import { apiRequest, getApiBaseUrl } from "@/lib/api";
import type {
  AssistantSessionListItem,
  AssistantSessionPayload,
  AssistantTablePayload,
} from "@/lib/assistant/types";

const SESSION_KEY = "hr-assistant-session";

export function readAssistantSessionId() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeAssistantSessionId(id: string) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearAssistantSessionId() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchAssistantSession(sessionId: string) {
  const payload = await apiRequest<{ data: AssistantSessionPayload }>(`/assistant/sessions/${sessionId}`);
  return payload.data;
}

export async function fetchAssistantSessions() {
  const payload = await apiRequest<{ data: { sessions: AssistantSessionListItem[] } }>("/assistant/sessions");
  return payload.data.sessions;
}

export type AssistantStreamEvent =
  | { event: "session"; data: { id: string } }
  | { event: "step_start"; data: { id: string; label: string } }
  | { event: "step_done"; data: { id: string } }
  | { event: "table"; data: AssistantTablePayload }
  | { event: "answer"; data: { text: string } }
  | { event: "error"; data: { message: string } }
  | { event: "done"; data: { sessionId?: string } };

export async function streamAssistantChat(
  input: { message: string; sessionId?: string },
  onEvent: (event: AssistantStreamEvent) => void,
) {
  const response = await fetch(`${getApiBaseUrl()}/assistant/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? "The assistant could not complete that request.");
  }
  if (!response.body) throw new Error("The assistant could not complete that request.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const parsed = parseSseBlock(part);
      if (parsed) onEvent(parsed);
    }
  }
}

function parseSseBlock(block: string): AssistantStreamEvent | null {
  const event = /^event: (.+)$/m.exec(block)?.[1]?.trim();
  const dataLine = /^data: (.+)$/m.exec(block)?.[1];
  if (!event || dataLine == null) return null;
  const data = JSON.parse(dataLine) as unknown;
  if (event === "session") return { event, data: data as { id: string } };
  if (event === "step_start") return { event, data: data as { id: string; label: string } };
  if (event === "step_done") return { event, data: data as { id: string } };
  if (event === "table") return { event, data: data as AssistantTablePayload };
  if (event === "answer") return { event, data: data as { text: string } };
  if (event === "error") return { event, data: data as { message: string } };
  if (event === "done") return { event, data: data as { sessionId?: string } };
  return null;
}
