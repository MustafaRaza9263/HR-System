import type { JsonSchema } from "../types.js";

const GEMINI_TYPES = {
  object: "OBJECT",
  array: "ARRAY",
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function primaryType(type: unknown): string | undefined {
  if (Array.isArray(type)) {
    const value: unknown = type.find((entry: unknown) => entry !== "null");
    return typeof value === "string" ? value : undefined;
  }
  return typeof type === "string" ? type : undefined;
}

function isNullable(type: unknown, nullable: unknown) {
  if (nullable === true) return true;
  return Array.isArray(type) && type.includes("null");
}

/**
 * Gemini `responseSchema` is an OpenAPI/proto Schema, not JSON Schema:
 * single `type` enum, `nullable` instead of type unions, no `additionalProperties`.
 */
export function toGeminiResponseSchema(schema: JsonSchema): Record<string, unknown> {
  const source = asRecord(schema) ?? {};
  const out: Record<string, unknown> = {};

  const jsonType = primaryType(source.type);
  const geminiType = jsonType ? GEMINI_TYPES[jsonType as keyof typeof GEMINI_TYPES] : undefined;
  if (geminiType) out.type = geminiType;
  if (isNullable(source.type, source.nullable)) out.nullable = true;

  if (typeof source.description === "string") out.description = source.description;
  if (typeof source.maxItems === "number") out.maxItems = source.maxItems;
  if (typeof source.minItems === "number") out.minItems = source.minItems;
  if (typeof source.maxLength === "number") out.maxLength = source.maxLength;
  if (typeof source.minimum === "number") out.minimum = source.minimum;
  if (typeof source.maximum === "number") out.maximum = source.maximum;

  if (Array.isArray(source.enum)) {
    out.enum = source.enum.filter((entry) => entry !== null).map((entry) => String(entry));
  }

  if (source.items) out.items = toGeminiResponseSchema(asRecord(source.items) ?? {});

  const properties = asRecord(source.properties);
  if (properties) {
    const next: Record<string, unknown> = {};
    const order: string[] = [];
    for (const [key, value] of Object.entries(properties)) {
      next[key] = toGeminiResponseSchema(asRecord(value) ?? {});
      order.push(key);
    }
    out.properties = next;
    out.propertyOrdering = order;
  }

  if (Array.isArray(source.required)) {
    out.required = source.required.filter((entry) => typeof entry === "string");
  }

  return out;
}
