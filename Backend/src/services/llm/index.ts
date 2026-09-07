import { env } from "../../config/env.js";

import { createGeminiProvider } from "./providers/gemini.js";
import type { LlmProvider } from "./types.js";

export type { GenerateStructuredInput, JsonSchema, LlmProvider } from "./types.js";

function createLlmProvider(): LlmProvider {
  switch (env.LLM_PROVIDER) {
    case "gemini":
      return createGeminiProvider();
    default: {
      const unsupported: never = env.LLM_PROVIDER;
      throw new Error(`Unsupported LLM provider: ${String(unsupported)}`);
    }
  }
}

let provider: LlmProvider | undefined;

/** Returns the configured structured-output adapter. Swap providers via env, not call sites. */
export function getLlmProvider(): LlmProvider {
  provider ??= createLlmProvider();
  return provider;
}
