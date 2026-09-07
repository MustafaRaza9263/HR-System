export type JsonSchema = Record<string, unknown>;

export type GenerateStructuredInput = {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: JsonSchema;
};

/**
 * Vendor-neutral contract. New providers implement this and register in
 * `createLlmProvider`. Callers never import a vendor SDK.
 */
export interface LlmProvider {
  readonly id: string;
  generateStructured(input: GenerateStructuredInput): Promise<unknown>;
}
