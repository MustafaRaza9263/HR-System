export type AssistantColumnType = "text" | "status" | "person" | "datetime";

export interface AssistantTableColumn {
  key: string;
  label: string;
  type: AssistantColumnType;
}

export interface AssistantTablePayload {
  columns: AssistantTableColumn[];
  rows: string[][];
}

export interface AssistantStep {
  id: string;
  label: string;
  status: "running" | "done";
}

export interface AssistantChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: AssistantStep[];
  table: AssistantTablePayload | null;
  createdAt: string;
  pending?: boolean;
}

export interface AssistantSessionListItem {
  id: string;
  title: string;
  updatedAt: string;
}

export interface AssistantSessionPayload {
  id: string;
  messages: AssistantChatMessage[];
}
