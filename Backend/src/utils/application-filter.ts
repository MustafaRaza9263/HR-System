import { Types } from "mongoose";

import { TERMINAL_APPLICATION_STATUSES } from "../schemas/application.schema.js";

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildApplicationFilter(input: {
  q?: string | undefined;
  jobId?: string | undefined;
  roleId?: string | undefined;
  status?: string | undefined;
  applicationIds?: string[] | undefined;
  excludeTerminal?: boolean | undefined;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (input.jobId) filter.jobId = input.jobId;
  if (input.roleId) filter["roleSnapshot.roleId"] = input.roleId;

  const statusIsTerminal =
    Boolean(input.status) && (TERMINAL_APPLICATION_STATUSES as readonly string[]).includes(input.status!);

  if (input.excludeTerminal && statusIsTerminal) {
    filter._id = { $in: [] };
    return filter;
  }

  if (input.status) {
    filter.status = input.status;
  } else if (input.excludeTerminal) {
    filter.status = { $nin: [...TERMINAL_APPLICATION_STATUSES] };
  }

  if (input.q) {
    const escaped = escapeRegex(input.q);
    filter.$or = [
      { candidateName: { $regex: escaped, $options: "i" } },
      { candidateEmail: { $regex: escaped, $options: "i" } },
    ];
  }

  if (input.applicationIds && input.applicationIds.length > 0) {
    filter._id = { $in: input.applicationIds.map((id) => new Types.ObjectId(id)) };
  }

  return filter;
}
