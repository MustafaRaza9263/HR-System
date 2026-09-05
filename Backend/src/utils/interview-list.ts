import { Types } from "mongoose";

import { Application } from "../models/application.model.js";
import { Interview } from "../models/interview.model.js";
import { escapeRegex } from "./application-filter.js";
import { shiftCalendarDate, todayCalendarDate } from "./date-state.js";
import { paginationMeta } from "./pagination.js";
import { serializeInterviews } from "./serialize-interview.js";

const APPLICATION_LIST_PROJECT = {
  candidateName: 1,
  candidateEmail: 1,
  candidatePhone: 1,
  jobId: 1,
  "roleSnapshot.title": 1,
  "roleSnapshot.departmentName": 1,
  "roleSnapshot.roleId": 1,
} as const;

interface ApplicationSnippet {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  jobId: Types.ObjectId;
  roleSnapshot: { title: string; departmentName: string };
}

interface InterviewListQuery {
  q?: string | undefined;
  jobId?: string | undefined;
  roleId?: string | undefined;
  status?: "scheduled" | "completed" | "no_show" | "cancelled" | "overdue" | undefined;
  bucket?: "scheduled" | "today" | "tomorrow" | "overdue" | undefined;
  page: number;
  limit: number;
}

function interviewFieldMatch(
  query: Pick<InterviewListQuery, "status" | "bucket">,
  today: string,
  tomorrow: string,
): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [];

  if (query.status === "overdue") {
    parts.push({ status: "scheduled", date: { $lt: today } });
  } else if (query.status) {
    parts.push({ status: query.status });
  }

  if (query.bucket === "scheduled") parts.push({ status: "scheduled" });
  if (query.bucket === "today") parts.push({ status: "scheduled", date: today });
  if (query.bucket === "tomorrow") parts.push({ status: "scheduled", date: tomorrow });
  if (query.bucket === "overdue") parts.push({ status: "scheduled", date: { $lt: today } });

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0]!;
  return { $and: parts };
}

function applicationFieldMatch(query: Pick<InterviewListQuery, "q" | "jobId" | "roleId">): Record<string, unknown> | null {
  const parts: Record<string, unknown>[] = [];
  if (query.jobId) parts.push({ "application.jobId": new Types.ObjectId(query.jobId) });
  if (query.roleId) parts.push({ "application.roleSnapshot.roleId": new Types.ObjectId(query.roleId) });
  if (query.q) {
    const rx = { $regex: escapeRegex(query.q), $options: "i" };
    parts.push({
      $or: [
        { label: rx },
        { "application.candidateName": rx },
        { "application.candidateEmail": rx },
        { "application.candidatePhone": rx },
        { "application.roleSnapshot.title": rx },
      ],
    });
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return { $and: parts };
}

async function interviewBoardStats(today: string, tomorrow: string) {
  const [[row], total] = await Promise.all([
    Interview.aggregate<{
      scheduled: number;
      today: number;
      tomorrow: number;
      overdue: number;
    }>([
      { $match: { status: "scheduled" } },
      {
        $group: {
          _id: null,
          scheduled: { $sum: 1 },
          today: { $sum: { $cond: [{ $eq: ["$date", today] }, 1, 0] } },
          tomorrow: { $sum: { $cond: [{ $eq: ["$date", tomorrow] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $lt: ["$date", today] }, 1, 0] } },
        },
      },
    ]),
    Interview.countDocuments(),
  ]);

  return {
    total,
    scheduled: row?.scheduled ?? 0,
    today: row?.today ?? 0,
    tomorrow: row?.tomorrow ?? 0,
    overdue: row?.overdue ?? 0,
  };
}

async function loadApplicationSnippets(ids: Types.ObjectId[]) {
  if (ids.length === 0) return new Map<string, ApplicationSnippet>();
  const unique = [...new Map(ids.map((id) => [id.toString(), id])).values()];
  const applications = await Application.find({ _id: { $in: unique } })
    .select("candidateName candidateEmail candidatePhone jobId roleSnapshot.title roleSnapshot.departmentName")
    .lean();
  return new Map(
    applications.map((item) => [
      item._id.toString(),
      {
        candidateName: item.candidateName,
        candidateEmail: item.candidateEmail,
        candidatePhone: item.candidatePhone,
        jobId: item.jobId,
        roleSnapshot: {
          title: item.roleSnapshot.title,
          departmentName: item.roleSnapshot.departmentName,
        },
      } satisfies ApplicationSnippet,
    ]),
  );
}

async function toBoardRows(
  interviews: Array<{
    _id: Types.ObjectId;
    applicationId: Types.ObjectId;
    departmentId: Types.ObjectId;
    label?: string | null;
    date: string;
    time: string;
    durationMinutes: number;
    status: string;
    createdBy: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
    application?: ApplicationSnippet;
  }>,
) {
  const missingIds = interviews.filter((item) => !item.application).map((item) => item.applicationId);
  const loaded = await loadApplicationSnippets(missingIds);
  const serialized = await serializeInterviews(interviews);
  const byId = new Map(interviews.map((item) => [item._id.toString(), item]));

  return serialized.flatMap((interview) => {
    const application = byId.get(interview.id)?.application ?? loaded.get(interview.applicationId);
    if (!application) return [];
    return [
      {
        ...interview,
        candidateName: application.candidateName,
        candidateEmail: application.candidateEmail,
        candidatePhone: application.candidatePhone,
        jobTitle: application.roleSnapshot.title,
        jobId: application.jobId.toString(),
        departmentName: application.roleSnapshot.departmentName,
      },
    ];
  });
}

export async function listHrInterviews(query: InterviewListQuery) {
  const today = todayCalendarDate();
  const tomorrow = shiftCalendarDate(today, 1);
  const skip = (query.page - 1) * query.limit;
  const interviewMatch = interviewFieldMatch(query, today, tomorrow);
  const applicationMatch = applicationFieldMatch(query);

  const statsPromise = interviewBoardStats(today, tomorrow);

  if (!applicationMatch) {
    const [total, interviews, stats] = await Promise.all([
      Interview.countDocuments(interviewMatch),
      Interview.find(interviewMatch).sort({ date: 1, time: 1, _id: 1 }).skip(skip).limit(query.limit).lean(),
      statsPromise,
    ]);
    const rows = await toBoardRows(interviews);
    return { interviews: rows, stats, pagination: paginationMeta(total, query.page, query.limit) };
  }

  const [facet, stats] = await Promise.all([
    Interview.aggregate<{ total: Array<{ count: number }>; rows: Array<Record<string, unknown>> }>([
      { $match: interviewMatch },
      {
        $lookup: {
          from: Application.collection.name,
          localField: "applicationId",
          foreignField: "_id",
          pipeline: [{ $project: APPLICATION_LIST_PROJECT }],
          as: "application",
        },
      },
      { $unwind: "$application" },
      { $match: applicationMatch },
      {
        $facet: {
          total: [{ $count: "count" }],
          rows: [{ $sort: { date: 1, time: 1, _id: 1 } }, { $skip: skip }, { $limit: query.limit }],
        },
      },
    ]).then((result) => result[0]),
    statsPromise,
  ]);

  const total = facet?.total[0]?.count ?? 0;
  const rows = await toBoardRows(
    (facet?.rows ?? []) as Array<{
      _id: Types.ObjectId;
      applicationId: Types.ObjectId;
      departmentId: Types.ObjectId;
      label?: string | null;
      date: string;
      time: string;
      durationMinutes: number;
      status: string;
      createdBy: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
      application: ApplicationSnippet;
    }>,
  );

  return {
    interviews: rows,
    stats,
    pagination: paginationMeta(total, query.page, query.limit),
  };
}
