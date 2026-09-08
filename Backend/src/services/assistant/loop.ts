import { randomUUID } from "node:crypto";

import { z } from "zod";

import { AssistantSession } from "../../models/assistant-session.model.js";
import { getLlmProvider } from "../llm/index.js";
import { ApiError } from "../../utils/api-error.js";
import { logger } from "../../utils/logger.js";
import { assistantSystemPrompt, assistantTurnSchema } from "./prompt.js";
import type { AssistantTable } from "./tools/render-table.js";
import "./tools/index.js";
import { getTool, toolNames } from "./tools/registry.js";

const MAX_ROUNDS = 8;
const HISTORY_CAP = 24;
const RESULT_CHARS = 8000;
const MESSAGE_CAP = 40;

const modelTurnSchema = z.object({
  action: z.enum(["call_tool", "answer"]),
  toolName: z.string(),
  toolArgsJson: z.string(),
  answer: z.string(),
});

export type AssistantStepEvent = { id: string; label: string };

export type AssistantTurnEvents = {
  onSession: (sessionId: string) => void;
  onStepStart: (step: AssistantStepEvent) => void;
  onStepDone: (stepId: string) => void;
  onTable: (table: AssistantTable) => void;
  onAnswer: (text: string) => void;
};

type HistoryEntry = { role: "user" | "assistant" | "tool"; text: string };

function shapeOf(value: unknown): string {
  if (Array.isArray(value)) return `array(len=${String(value.length)})`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const count = typeof record.matchCount === "number" ? ` matchCount=${String(record.matchCount)}` : "";
    return `object keys=${Object.keys(record).join(",")}${count}`;
  }
  return typeof value;
}

function clip(value: string, max = RESULT_CHARS) {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function stringifyResult(value: unknown) {
  try {
    return clip(JSON.stringify(value));
  } catch {
    return clip(String(value));
  }
}

function parseArgs(raw: string): unknown {
  const trimmed = raw.trim() || "{}";
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("Tool arguments were not valid JSON.");
  }
}

export async function runAssistantTurn(input: {
  userId: string;
  sessionId?: string;
  message: string;
  events: AssistantTurnEvents;
}) {
  const started = Date.now();
  const turnId = randomUUID();
  logger.info(`assistant turn=${turnId} question=${clip(JSON.stringify(input.message), 400)}`);

  let session = input.sessionId
    ? await AssistantSession.findOne({ _id: input.sessionId, userId: input.userId })
    : null;
  if (input.sessionId && !session) {
    throw new ApiError(404, "ASSISTANT_SESSION_NOT_FOUND", "That conversation was not found.");
  }
  if (!session) {
    session = await AssistantSession.create({ userId: input.userId, messages: [], modelHistory: [] });
  }
  input.events.onSession(session.id);

  const userMessage = {
    id: randomUUID(),
    role: "user" as const,
    content: input.message,
    steps: [] as Array<{ id: string; label: string; status: "done" }>,
    createdAt: new Date(),
  };
  session.messages.push(userMessage);

  const history: HistoryEntry[] = session.modelHistory.map((entry) => ({
    role: entry.role,
    text: entry.text,
  }));
  history.push({ role: "user", text: input.message });

  const names = toolNames();
  const provider = getLlmProvider();
  const steps: Array<{ id: string; label: string; status: "done" }> = [];
  let table: AssistantTable | undefined;
  let answer = "";

  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const roundStarted = Date.now();
      const raw = await provider.generateStructured({
        systemPrompt: assistantSystemPrompt(),
        userPrompt: [
          "Conversation so far (oldest first):",
          history.map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`).join("\n\n"),
          "",
          "Return call_tool or answer.",
        ].join("\n"),
        jsonSchema: assistantTurnSchema(names),
      });

      const parsed = modelTurnSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn(`assistant turn=${turnId} malformed model output`);
        answer = "I could not complete that lookup. Please try asking again.";
        break;
      }

      const decision = parsed.data;
      if (decision.action === "answer") {
        answer = decision.answer.trim();
        logger.info(`assistant turn=${turnId} answer ms=${String(Date.now() - roundStarted)}`);
        break;
      }

      const tool = getTool(decision.toolName);
      if (!tool) {
        history.push({
          role: "tool",
          text: `Unknown tool "${decision.toolName}". Available: ${names.join(", ")}.`,
        });
        continue;
      }

      const stepId = randomUUID();
      const step = { id: stepId, label: tool.label };
      input.events.onStepStart(step);
      const toolStarted = Date.now();
      let result: unknown;
      try {
        const args = parseArgs(decision.toolArgsJson);
        const toolInput = tool.inputSchema.parse(args);
        result = await tool.execute(toolInput);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool failed.";
        result = { error: message };
      }

      logger.info(
        `assistant turn=${turnId} tool=${tool.name} shape=${shapeOf(result)} ms=${String(Date.now() - toolStarted)}`,
      );
      input.events.onStepDone(stepId);
      steps.push({ id: stepId, label: tool.label, status: "done" });

      if (tool.family === "render" && result && typeof result === "object" && "table" in result) {
        const rendered = (result as { table?: AssistantTable }).table;
        if (rendered) {
          table = rendered;
          input.events.onTable(rendered);
        }
        history.push({
          role: "tool",
          text: `render_table: showed ${String((result as { rowCount?: number }).rowCount ?? 0)} rows in the UI. Now answer HR (or ask them to pick if several people matched).`,
        });
      } else {
        history.push({
          role: "tool",
          text: `${tool.name} result: ${stringifyResult(result)}`,
        });
      }
    }
  } catch (error) {
    logger.error(`assistant turn=${turnId} failed`, error);
    answer = "The assistant is unavailable right now. Please try again in a moment.";
  }

  if (!answer.trim()) {
    answer = "I ran out of lookup steps before I could finish. Please try a more specific question.";
  }

  const assistantMessage = {
    id: randomUUID(),
    role: "assistant" as const,
    content: answer,
    steps,
    ...(table ? { table } : {}),
    createdAt: new Date(),
  };
  session.messages.push(assistantMessage);
  history.push({ role: "assistant", text: answer });

  session.modelHistory.splice(
    0,
    session.modelHistory.length,
    ...history.slice(-HISTORY_CAP).map((entry) => ({ role: entry.role, text: clip(entry.text, 12000) })),
  );
  while (session.messages.length > MESSAGE_CAP) {
    session.messages.shift();
  }
  await session.save();

  logger.info(`assistant turn=${turnId} done session=${session.id} ms=${String(Date.now() - started)} tools=${String(steps.length)}`);
  input.events.onAnswer(answer);

  return { sessionId: session.id };
}
