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
  scoreMin?: number | undefined;
  scoreMax?: number | undefined;
  scoreLessThan?: number | undefined;
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

  const score: Record<string, number> = {};
  if (typeof input.scoreMin === "number") score.$gte = input.scoreMin;
  if (typeof input.scoreMax === "number") score.$lte = input.scoreMax;
  if (typeof input.scoreLessThan === "number") score.$lt = input.scoreLessThan;
  if (Object.keys(score).length > 0) filter["scoring.score"] = score;

  return filter;
}

export function buildApplicationStatsMatch(input: {
  q?: string | undefined;
  jobId?: string | undefined;
  roleId?: string | undefined;
  status?: string | undefined;
  scoreMin?: number | undefined;
  scoreMax?: number | undefined;
  scoreLessThan?: number | undefined;
}): Record<string, unknown> {
  return castApplicationFilterForAggregate(
    buildApplicationFilter({
      q: input.q,
      jobId: input.jobId,
      roleId: input.roleId,
      status: input.status,
      scoreMin: input.scoreMin,
      scoreMax: input.scoreMax,
      scoreLessThan: input.scoreLessThan,
    }),
  );
}

function castApplicationFilterForAggregate(filter: Record<string, unknown>): Record<string, unknown> {
  const match = { ...filter };
  if (typeof match.jobId === "string" && Types.ObjectId.isValid(match.jobId)) {
    match.jobId = new Types.ObjectId(match.jobId);
  }
  const roleId = match["roleSnapshot.roleId"];
  if (typeof roleId === "string" && Types.ObjectId.isValid(roleId)) {
    match["roleSnapshot.roleId"] = new Types.ObjectId(roleId);
  }
  return match;
}
