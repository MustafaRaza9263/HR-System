import type { z } from "zod";

export type AssistantToolFamily = "data" | "render";

export interface AssistantTool<T = unknown> {
  name: string;
  family: AssistantToolFamily;
  label: string;
  description: string;
  argsHint: string;
  inputSchema: z.ZodType<T>;
  execute: (input: T) => Promise<unknown>;
}

const tools = new Map<string, AssistantTool>();

export function registerTool<T>(tool: AssistantTool<T>) {
  tools.set(tool.name, tool as AssistantTool);
}

export function getTool(name: string) {
  return tools.get(name);
}

export function listTools() {
  return [...tools.values()];
}

export function toolNames() {
  return listTools().map((tool) => tool.name);
}

export function toolCatalogForPrompt() {
  return listTools()
    .map(
      (tool) =>
        `- ${tool.name} [${tool.family}]: ${tool.description}\n  Args JSON: ${tool.argsHint}`,
    )
    .join("\n");
}
