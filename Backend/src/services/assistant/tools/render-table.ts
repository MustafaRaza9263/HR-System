import { z } from "zod";

import { registerTool } from "./registry.js";

export const TABLE_COLUMN_TYPES = ["text", "status", "person", "datetime"] as const;
export type TableColumnType = (typeof TABLE_COLUMN_TYPES)[number];

export const renderTableSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(40),
        type: z.enum(TABLE_COLUMN_TYPES),
      }),
    )
    .min(1)
    .max(8),
  rows: z
    .array(
      z.object({
        values: z.array(z.string().max(500)).min(1).max(8),
      }),
    )
    .min(1)
    .max(15),
});

export type AssistantTable = {
  columns: Array<{ key: string; label: string; type: TableColumnType }>;
  rows: string[][];
};

registerTool({
  name: "render_table",
  family: "render",
  label: "Preparing a table",
  description:
    "Display rows the UI already has as a table. Use for multiple people or any list with several fields. Person columns: 'Name|email'. Status columns: the raw status string. Datetime columns: ISO timestamps. Do not use for a single fact.",
  argsHint:
    '{"columns":[{"key":"candidate","label":"Candidate","type":"person"},{"key":"status","label":"Status","type":"status"}],"rows":[{"values":["Ahmed Ali|ahmed@example.com","rejected"]}]}',
  inputSchema: renderTableSchema,
  execute: async (input) => {
    const columns = input.columns;
    const rows = input.rows.map((row) => {
      const values = [...row.values];
      while (values.length < columns.length) values.push("");
      return values.slice(0, columns.length);
    });
    const table: AssistantTable = { columns, rows };
    return { rendered: true, rowCount: rows.length, table };
  },
});
