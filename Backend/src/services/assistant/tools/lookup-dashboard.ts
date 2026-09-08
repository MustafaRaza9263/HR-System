import { Types } from "mongoose";
import { z } from "zod";

import { TREND_GRANULARITIES, trendBucketDates, trendDateTrunc } from "../../../utils/dashboard-trend.js";
import { shiftCalendarDate, startOfCalendarInstant, todayCalendarDate } from "../../../utils/date-state.js";
import { asObjectId, idString } from "../ids.js";
import { READ_COLLECTIONS, readDb } from "../read.js";
import { registerTool } from "./registry.js";

const APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "interview_scheduled",
  "interviewed",
  "approved",
  "rejected",
  "trial",
] as const;

const inputSchema = z.object({
  metric: z.enum(["summary", "pipeline", "trend", "sources", "upcoming", "interviewers"]),
  job: z.string().trim().max(24).optional(),
  granularity: z.enum(TREND_GRANULARITIES).optional(),
  day: z.enum(["today", "tomorrow"]).optional(),
});

type CountRow = { n?: number };

function countOf(rows: CountRow[] | undefined) {
  return rows?.[0]?.n ?? 0;
}

function titleCase(value: string) {
  return value.replace(/[a-z0-9]+/gi, (part) => part.charAt(0).toUpperCase() + part.slice(1));
}

function campaignLabel(value: string) {
  const trimmed = value.trim();
  return trimmed ? titleCase(trimmed) : "Organic";
}

async function applicationJobMatch(job: string | undefined): Promise<Record<string, unknown>> {
  if (!job || job === "all") return {};
  if (job === "open" || job === "compare") {
    const jobs = await readDb.find(READ_COLLECTIONS.jobs, { status: "open" }, { projection: { _id: 1 } });
    return { jobId: { $in: jobs.map((item) => item._id) } };
  }
  const jobId = asObjectId(job);
  if (!jobId) return { jobId: { $in: [] } };
  return { jobId };
}

registerTool({
  name: "lookup_dashboard",
  family: "data",
  label: "Checking dashboard metrics",
  description:
    "Dashboard numbers. Use metric summary for KPI questions including how many applications were received today (applicationsToday). Use pipeline only for all-time current-status bars (Submitted is not arrivals today). Also: trend, sources, upcoming interviews, today's guest interviewers.",
  argsHint:
    '{"metric":"summary|pipeline|trend|sources|upcoming|interviewers","job":"all|open|compare|24-hex job id","granularity":"daily|weekly|monthly|yearly for trend","day":"today|tomorrow for upcoming"}',
  inputSchema,
  async execute(input) {
    const today = todayCalendarDate();

    if (input.metric === "summary") {
      const monthStart = `${today.slice(0, 7)}-01`;
      const todayStart = startOfCalendarInstant(today);
      const tomorrowStart = startOfCalendarInstant(shiftCalendarDate(today, 1));
      const monthStartInstant = startOfCalendarInstant(monthStart);
      const [jobFacet, appFacet, interviewsToday] = await Promise.all([
        readDb.aggregate(READ_COLLECTIONS.jobs, [
          {
            $facet: {
              open: [{ $match: { status: "open" } }, { $count: "n" }],
              publishedThisMonth: [{ $match: { publishedAt: { $gte: monthStartInstant } } }, { $count: "n" }],
            },
          },
        ]),
        readDb.aggregate(READ_COLLECTIONS.applications, [
          {
            $facet: {
              total: [{ $count: "n" }],
              today: [{ $match: { createdAt: { $gte: todayStart, $lt: tomorrowStart } } }, { $count: "n" }],
              hired: [{ $match: { status: "approved" } }, { $count: "n" }],
              hiredThisMonth: [{ $match: { approvedAt: { $gte: monthStartInstant } } }, { $count: "n" }],
            },
          },
        ]),
        readDb.countDocuments(READ_COLLECTIONS.interviews, { status: "scheduled", date: today }),
      ]);
      const jobs = jobFacet[0] as { open?: CountRow[]; publishedThisMonth?: CountRow[] } | undefined;
      const apps = appFacet[0] as {
        total?: CountRow[];
        today?: CountRow[];
        hired?: CountRow[];
        hiredThisMonth?: CountRow[];
      } | undefined;
      return {
        metric: "summary",
        today,
        openJobs: countOf(jobs?.open),
        publishedThisMonth: countOf(jobs?.publishedThisMonth),
        applications: countOf(apps?.total),
        applicationsToday: countOf(apps?.today),
        hired: countOf(apps?.hired),
        hiredThisMonth: countOf(apps?.hiredThisMonth),
        interviewsToday,
        meaning: {
          applications: "All-time total applications.",
          applicationsToday:
            "Applications received today (Asia/Karachi createdAt). Use this for 'how many applications today'. Not the pipeline Submitted bar.",
          hired: "All-time applications currently approved.",
          hiredThisMonth: "Applications approved this calendar month.",
          interviewsToday: "Interviews scheduled for today's calendar date.",
        },
      };
    }

    if (input.metric === "pipeline") {
      const match = await applicationJobMatch(input.job);
      const grouped = (await readDb.aggregate(READ_COLLECTIONS.applications, [
        ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])) as Array<{ _id: string; count: number }>;
      const byStatus = new Map(grouped.map((row) => [row._id, row.count]));
      return {
        metric: "pipeline",
        job: input.job ?? "all",
        scope: "all-time current-status totals, not applications received today",
        counts: Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, byStatus.get(status) ?? 0])),
        meaning: {
          submitted:
            "Applications whose current status is still Submitted, all-time. Do not report this as applications received today.",
        },
      };
    }

    if (input.metric === "trend") {
      const granularity = input.granularity ?? "daily";
      const job = input.job ?? "all";
      const dates = trendBucketDates(granularity, today);
      const createdAt = { $gte: startOfCalendarInstant(dates[0]!) };
      const bucket = trendDateTrunc(granularity);

      if (job === "compare") {
        const openJobs = await readDb.find(
          READ_COLLECTIONS.jobs,
          { status: "open" },
          { projection: { title: 1 }, sort: { title: 1 } },
        );
        const grouped = (await readDb.aggregate(READ_COLLECTIONS.applications, [
          { $match: { jobId: { $in: openJobs.map((item) => item._id) }, createdAt } },
          { $group: { _id: { date: bucket, jobId: "$jobId" }, count: { $sum: 1 } } },
        ])) as Array<{ _id: { date: string; jobId: Types.ObjectId }; count: number }>;
        const countByJobDate = new Map(
          grouped.map((row) => [`${idString(row._id.jobId)}:${row._id.date}`, row.count]),
        );
        return {
          metric: "trend",
          granularity,
          series: openJobs.map((item) => {
            const jobId = idString(item._id);
            return {
              id: jobId,
              name: String(item.title ?? ""),
              points: dates.map((date) => ({ date, count: countByJobDate.get(`${jobId}:${date}`) ?? 0 })),
            };
          }),
        };
      }

      const match = await applicationJobMatch(job);
      const grouped = (await readDb.aggregate(READ_COLLECTIONS.applications, [
        { $match: { ...match, createdAt } },
        { $group: { _id: bucket, count: { $sum: 1 } } },
      ])) as Array<{ _id: string; count: number }>;
      const byDate = new Map(grouped.map((row) => [row._id, row.count]));
      return {
        metric: "trend",
        granularity,
        job,
        series: [
          {
            id: "total",
            name: "Applications",
            points: dates.map((date) => ({ date, count: byDate.get(date) ?? 0 })),
          },
        ],
      };
    }

    if (input.metric === "sources") {
      const match = await applicationJobMatch(input.job);
      const grouped = (await readDb.aggregate(READ_COLLECTIONS.applications, [
        ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
        {
          $group: {
            _id: {
              source: {
                $let: {
                  vars: { normalized: { $toLower: { $trim: { input: { $ifNull: ["$source", ""] } } } } },
                  in: { $cond: [{ $eq: ["$$normalized", ""] }, "website", "$$normalized"] },
                },
              },
              campaign: {
                $let: {
                  vars: { normalized: { $toLower: { $trim: { input: { $ifNull: ["$campaign", ""] } } } } },
                  in: { $cond: [{ $in: ["$$normalized", ["", "organic"]] }, "", "$$normalized"] },
                },
              },
            },
            applications: { $sum: 1 },
            interviewed: { $sum: { $cond: [{ $gt: ["$completedInterviewCount", 0] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          },
        },
      ])) as Array<{
        _id: { source: string; campaign: string };
        applications: number;
        interviewed: number;
        approved: number;
      }>;

      const bySource = new Map<
        string,
        {
          source: string;
          name: string;
          applications: number;
          interviewed: number;
          approved: number;
          campaigns: Array<{ name: string; applications: number; interviewed: number; approved: number }>;
        }
      >();
      for (const row of grouped) {
        const sourceKey = row._id.source || "website";
        const current = bySource.get(sourceKey) ?? {
          source: sourceKey,
          name: titleCase(sourceKey),
          applications: 0,
          interviewed: 0,
          approved: 0,
          campaigns: [],
        };
        current.applications += row.applications;
        current.interviewed += row.interviewed;
        current.approved += row.approved;
        current.campaigns.push({
          name: campaignLabel(row._id.campaign),
          applications: row.applications,
          interviewed: row.interviewed,
          approved: row.approved,
        });
        bySource.set(sourceKey, current);
      }

      return {
        metric: "sources",
        job: input.job ?? "all",
        sources: [...bySource.values()].map((row) => ({
          ...row,
          campaigns: row.campaigns.sort((a, b) => b.applications - a.applications),
        })),
      };
    }

    if (input.metric === "upcoming") {
      const date = input.day === "tomorrow" ? shiftCalendarDate(today, 1) : today;
      const interviews = await readDb.aggregate(READ_COLLECTIONS.interviews, [
        { $match: { status: "scheduled", date } },
        { $sort: { time: 1 } },
        { $limit: 12 },
        {
          $lookup: {
            from: READ_COLLECTIONS.applications,
            localField: "applicationId",
            foreignField: "_id",
            pipeline: [{ $project: { candidateName: 1, "roleSnapshot.title": 1 } }],
            as: "application",
          },
        },
        { $unwind: { path: "$application", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            time: 1,
            label: 1,
            candidateName: { $ifNull: ["$application.candidateName", "Candidate"] },
            jobTitle: { $ifNull: ["$application.roleSnapshot.title", ""] },
          },
        },
      ]);
      return { metric: "upcoming", date, interviews };
    }

    const links = await readDb.find(
      READ_COLLECTIONS.departmentAccessLinks,
      { accessDate: today },
      { projection: { token: 1, departmentId: 1 } },
    );
    if (links.length === 0) return { metric: "interviewers", today, interviewers: [] };

    const tokens = links.map((link) => link.token);
    const [registrants, departments] = await Promise.all([
      readDb.find(
        READ_COLLECTIONS.linkRegistrants,
        { linkToken: { $in: tokens.map((token) => String(token)) }, status: { $in: ["approved", "pending_approval"] } },
        { projection: { name: 1, status: 1, linkToken: 1 }, sort: { requestedAt: -1 }, limit: 10 },
      ),
      readDb.find(
        READ_COLLECTIONS.departments,
        { _id: { $in: links.map((link) => link.departmentId) } },
        { projection: { name: 1 } },
      ),
    ]);
    const departmentById = new Map(departments.map((item) => [idString(item._id), String(item.name ?? "Department")]));
    const departmentByToken = new Map(
      links.map((link) => [String(link.token), departmentById.get(idString(link.departmentId)) ?? "Department"]),
    );

    return {
      metric: "interviewers",
      today,
      interviewers: registrants.map((item) => ({
        name: String(item.name ?? ""),
        departmentName: departmentByToken.get(String(item.linkToken)) ?? "Department",
        status: item.status === "approved" ? "approved" : "pending",
      })),
    };
  },
});
