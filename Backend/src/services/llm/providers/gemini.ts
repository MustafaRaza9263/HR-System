import { env } from "../../../config/env.js";
import { ApiError } from "../../../utils/api-error.js";
import { logger } from "../../../utils/logger.js";
import type { GenerateStructuredInput, LlmProvider } from "../types.js";
import { resumeUnreadableError } from "../unreadable.js";
import { toGeminiResponseSchema } from "./gemini-schema.js";

const GEMINI_TIMEOUT_MS = 60_000;

type GeminiPart = { text?: string; thought?: boolean };
type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { message?: string; status?: string };
};

function parseStructuredText(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw resumeUnreadableError();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = (fenced?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw resumeUnreadableError();
  }
}

function candidateText(payload: GeminiResponse) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((part) => !part.thought).map((part) => part.text ?? "").join("");
}

export function createGeminiProvider(): LlmProvider {
  return {
    id: "gemini",
    async generateStructured(input: GenerateStructuredInput) {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.warn("llm generateStructured skipped: GEMINI_API_KEY is not set");
        throw resumeUnreadableError();
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.LLM_MODEL)}:generateContent`;
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: input.userPrompt }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
              responseSchema: toGeminiResponseSchema(input.jsonSchema),
            },
          }),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        });
      } catch (error) {
        logger.error("gemini generateStructured request failed", error);
        throw resumeUnreadableError();
      }

      const payload = (await response.json().catch(() => ({}))) as GeminiResponse;
      if (!response.ok) {
        logger.error(
          `gemini generateStructured http ${String(response.status)}`,
          payload.error?.message ?? payload.error?.status ?? "request failed",
        );
        throw resumeUnreadableError();
      }

      try {
        return parseStructuredText(candidateText(payload));
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error("gemini generateStructured parse failed", error);
        throw resumeUnreadableError();
      }
    },
  };
}
