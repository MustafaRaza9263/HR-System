import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { Types } from "mongoose";

import { authenticate } from "../middleware/authenticate.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { AssistantSession } from "../models/assistant-session.model.js";
import { assistantChatSchema, assistantSessionListQuerySchema } from "../schemas/assistant.schema.js";
import { runAssistantTurn } from "../services/assistant/loop.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

export const assistantRouter = Router();

const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many assistant requests. Try again later." },
  },
});

assistantRouter.use(authenticate);

function writeEvent(response: { write: (chunk: string) => unknown }, event: string, data: unknown) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function serializeSession(session: {
  _id: { toString(): string };
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    steps: Array<{ id: string; label: string; status: "done" }>;
    table?: {
      columns: Array<{ key: string; label: string; type: string }>;
      rows: unknown;
    } | null;
    createdAt: Date;
  }>;
}) {
  return {
    id: session._id.toString(),
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      steps: (message.steps ?? []).map((step) => ({ id: step.id, label: step.label, status: "done" as const })),
      table: message.table
        ? {
            columns: message.table.columns.map((column) => ({
              key: column.key,
              label: column.label,
              type: column.type,
            })),
            rows: Array.isArray(message.table.rows)
              ? message.table.rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []))
              : [],
          }
        : null,
      createdAt: new Date(message.createdAt).toISOString(),
    })),
  };
}

function sessionTitle(messages: Array<{ role: string; content: string }>) {
  const first = messages.find((message) => message.role === "user" && message.content.trim());
  if (!first) return "New chat";
  const text = first.content.trim().replace(/\s+/g, " ");
  return text.length > 72 ? `${text.slice(0, 71)}…` : text;
}

assistantRouter.get(
  "/sessions",
  asyncHandler(async (request, response) => {
    const query = assistantSessionListQuerySchema.parse(request.query);
    const sessions = await AssistantSession.find({ userId: request.auth!.user.id })
      .select("messages.content messages.role updatedAt")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const needle = query.q?.toLocaleLowerCase();
    const rows = sessions.flatMap((session) => {
      const title = sessionTitle(session.messages);
      if (session.messages.length === 0) return [];
      if (needle && !title.toLocaleLowerCase().includes(needle)) return [];
      return [
        {
          id: session._id.toString(),
          title,
          updatedAt: session.updatedAt.toISOString(),
        },
      ];
    });

    response.status(200).json({ data: { sessions: rows } });
  }),
);

assistantRouter.get(
  "/sessions/:sessionId",
  asyncHandler(async (request, response) => {
    const sessionId = String(request.params.sessionId ?? "");
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new ApiError(404, "ASSISTANT_SESSION_NOT_FOUND", "That conversation was not found.");
    }
    const session = await AssistantSession.findOne({
      _id: sessionId,
      userId: request.auth!.user.id,
    }).lean();
    if (!session) {
      throw new ApiError(404, "ASSISTANT_SESSION_NOT_FOUND", "That conversation was not found.");
    }
    response.status(200).json({
      data: serializeSession(session),
    });
  }),
);

assistantRouter.delete(
  "/sessions/:sessionId",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const sessionId = String(request.params.sessionId ?? "");
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new ApiError(404, "ASSISTANT_SESSION_NOT_FOUND", "That conversation was not found.");
    }
    const result = await AssistantSession.deleteOne({
      _id: sessionId,
      userId: request.auth!.user.id,
    });
    if (result.deletedCount === 0) {
      throw new ApiError(404, "ASSISTANT_SESSION_NOT_FOUND", "That conversation was not found.");
    }
    response.status(204).send();
  }),
);

assistantRouter.post("/chat", verifyBrowserOrigin, assistantLimiter, (request, response, next) => {
  void (async () => {
    const input = assistantChatSchema.parse(request.body);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();

    const result = await runAssistantTurn({
      userId: request.auth!.user.id,
      message: input.message,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      events: {
        onSession: (id) => writeEvent(response, "session", { id }),
        onStepStart: (step) => writeEvent(response, "step_start", step),
        onStepDone: (id) => writeEvent(response, "step_done", { id }),
        onTable: (table) => writeEvent(response, "table", table),
        onAnswer: (text) => writeEvent(response, "answer", { text }),
      },
    });

    writeEvent(response, "done", { sessionId: result.sessionId });
    response.end();
  })().catch((error: unknown) => {
    if (response.headersSent) {
      const message =
        error instanceof ApiError ? error.message : "The assistant could not complete that request.";
      writeEvent(response, "error", { message });
      writeEvent(response, "done", {});
      response.end();
      return;
    }
    next(error);
  });
});
