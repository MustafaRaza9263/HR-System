import { z } from "zod";

import { escapeRegex } from "../../../utils/application-filter.js";
import { asObjectId, idString } from "../ids.js";
import { READ_COLLECTIONS, readDb } from "../read.js";
import { registerTool } from "./registry.js";

const inputSchema = z.object({
  kind: z.enum(["departments", "roles"]),
  q: z.string().trim().max(120).optional(),
  departmentId: z.string().trim().max(24).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

registerTool({
  name: "lookup_org",
  family: "data",
  label: "Checking departments and roles",
  description: "List departments or roles. Roles can be filtered to one department.",
  argsHint: '{"kind":"departments|roles","q":"optional name","departmentId":"optional for roles","status":"active|inactive"}',
  inputSchema,
  async execute(input) {
    const filter: Record<string, unknown> = {};
    if (input.status) filter.status = input.status;
    if (input.q) filter.name = { $regex: escapeRegex(input.q), $options: "i" };
    const departmentId = asObjectId(input.departmentId);

    if (input.kind === "departments") {
      const rows = await readDb.find(READ_COLLECTIONS.departments, filter, {
        projection: { name: 1, status: 1, icon: 1 },
        sort: { name: 1 },
        limit: 50,
      });
      return {
        kind: "departments",
        matchCount: rows.length,
        departments: rows.map((row) => ({
          id: idString(row._id),
          name: String(row.name ?? ""),
          status: String(row.status ?? ""),
        })),
      };
    }

    if (departmentId) filter.departmentId = departmentId;
    const rows = await readDb.find(READ_COLLECTIONS.roles, filter, {
      projection: { name: 1, status: 1, departmentId: 1, icon: 1 },
      sort: { name: 1 },
      limit: 80,
    });
    return {
      kind: "roles",
      matchCount: rows.length,
      roles: rows.map((row) => ({
        id: idString(row._id),
        name: String(row.name ?? ""),
        status: String(row.status ?? ""),
        departmentId: idString(row.departmentId),
      })),
    };
  },
});
