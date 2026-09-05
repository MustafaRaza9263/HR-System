import { Router } from "express";

import { authenticate } from "../middleware/authenticate.js";
import { Application } from "../models/application.model.js";
import { Department } from "../models/department.model.js";
import { DepartmentAccessLink } from "../models/department-access-link.model.js";
import { Interview } from "../models/interview.model.js";
import { Job } from "../models/job.model.js";
import { LinkRegistrant } from "../models/link-registrant.model.js";
import { Notification } from "../models/notification.model.js";
import { hrefForNotification } from "../notifications/catalog.js";
import {
  dashboardActivityQuerySchema,
  dashboardJobQuerySchema,
  dashboardTrendQuerySchema,
  dashboardUpcomingQuerySchema,
} from "../schemas/dashboard.schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { applicationJobMatch, parseDashboardJobFilter } from "../utils/dashboard-filter.js";
import { trendBucketDates, trendDateTrunc } from "../utils/dashboard-trend.js";
import { shiftCalendarDate, startOfCalendarInstant, todayCalendarDate } from "../utils/date-state.js";

export const dashboardRouter = Router();

const TREND_DAYS = 184;
const APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "interview_scheduled",
  "interviewed",
  "approved",
  "rejected",
  "trial",
] as const;

type CountRow = { n: number };

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

dashboardRouter.use(authenticate);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (_request, response) => {
    const today = todayCalendarDate();
    const rangeStart = shiftCalendarDate(today, -(TREND_DAYS - 1));
    const monthStart = `${today.slice(0, 7)}-01`;
    const todayStart = startOfCalendarInstant(today);
    const tomorrowStart = startOfCalendarInstant(shiftCalendarDate(today, 1));
    const monthStartInstant = startOfCalendarInstant(monthStart);

    const [jobFacet, appFacet, interviewsToday] = await Promise.all([
      Job.aggregate<{ open: CountRow[]; publishedThisMonth: CountRow[] }>([
        {
          $facet: {
            open: [{ $match: { status: "open" } }, { $count: "n" }],
            publishedThisMonth: [{ $match: { publishedAt: { $gte: monthStartInstant } } }, { $count: "n" }],
          },
        },
      ]),
      Application.aggregate<{
        total: CountRow[];
        today: CountRow[];
        hired: CountRow[];
        hiredThisMonth: CountRow[];
      }>([
        {
          $facet: {
            total: [{ $count: "n" }],
            today: [{ $match: { createdAt: { $gte: todayStart, $lt: tomorrowStart } } }, { $count: "n" }],
            hired: [{ $match: { status: "approved" } }, { $count: "n" }],
            hiredThisMonth: [{ $match: { approvedAt: { $gte: monthStartInstant } } }, { $count: "n" }],
          },
        },
      ]),
      Interview.countDocuments({ status: "scheduled", date: today }),
    ]);

    const jobs = jobFacet[0];
    const apps = appFacet[0];

    response.status(200).json({
      data: {
        range: { start: rangeStart, end: today },
        openJobs: { value: countOf(jobs?.open), delta: countOf(jobs?.publishedThisMonth) },
        applications: { value: countOf(apps?.total), delta: countOf(apps?.today) },
        interviewsToday: { value: interviewsToday },
        hired: { value: countOf(apps?.hired), delta: countOf(apps?.hiredThisMonth) },
      },
    });
  }),
);

dashboardRouter.get(
  "/trend",
  asyncHandler(async (request, response) => {
    const query = dashboardTrendQuerySchema.parse(request.query);
    const job = parseDashboardJobFilter(query.job);
    const today = todayCalendarDate();
    const dates = trendBucketDates(query.granularity, today);
    const createdAt = { $gte: startOfCalendarInstant(dates[0]!) };
    const bucket = trendDateTrunc(query.granularity);

    if (job === "compare") {
      const openJobs = await Job.find({ status: "open" }).select("title").sort({ title: 1 }).lean();
      const grouped = await Application.aggregate<{ _id: { date: string; jobId: (typeof openJobs)[number]["_id"] }; count: number }>([
        { $match: { jobId: { $in: openJobs.map((item) => item._id) }, createdAt } },
        {
          $group: {
            _id: { date: bucket, jobId: "$jobId" },
            count: { $sum: 1 },
          },
        },
      ]);
      const countByJobDate = new Map(grouped.map((row) => [`${row._id.jobId.toString()}:${row._id.date}`, row.count]));
      response.status(200).json({
        data: {
          series: openJobs.map((item) => {
            const jobId = item._id.toString();
            return {
              id: jobId,
              name: item.title,
              points: dates.map((date) => ({ date, count: countByJobDate.get(`${jobId}:${date}`) ?? 0 })),
            };
          }),
        },
      });
      return;
    }

    const grouped = await Application.aggregate<{ _id: string; count: number }>([
      { $match: { ...(await applicationJobMatch(job)), createdAt } },
      { $group: { _id: bucket, count: { $sum: 1 } } },
    ]);
    const byDate = new Map(grouped.map((row) => [row._id, row.count]));
    response.status(200).json({
      data: {
        series: [
          {
            id: "total",
            name: "Applications",
            points: dates.map((date) => ({ date, count: byDate.get(date) ?? 0 })),
          },
        ],
      },
    });
  }),
);

dashboardRouter.get(
  "/pipeline",
  asyncHandler(async (request, response) => {
    const query = dashboardJobQuerySchema.parse(request.query);
    const job = parseDashboardJobFilter(query.job);
    const match = await applicationJobMatch(job);

    const grouped = await Application.aggregate<{ _id: string; count: number }>([
      ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const byStatus = new Map(grouped.map((row) => [row._id, row.count]));
    const counts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, byStatus.get(status) ?? 0]));

    response.status(200).json({ data: { counts } });
  }),
);

dashboardRouter.get(
  "/sources",
  asyncHandler(async (request, response) => {
    const query = dashboardJobQuerySchema.parse(request.query);
    const job = parseDashboardJobFilter(query.job);
    const match = await applicationJobMatch(job);

    const grouped = await Application.aggregate<{
      _id: { source: string; campaign: string };
      applications: number;
      interviewed: number;
      approved: number;
    }>([
      ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
      {
        $group: {
          _id: {
            source: {
              $let: {
                vars: {
                  normalized: { $toLower: { $trim: { input: { $ifNull: ["$source", ""] } } } },
                },
                in: { $cond: [{ $eq: ["$$normalized", ""] }, "website", "$$normalized"] },
              },
            },
            campaign: {
              $let: {
                vars: {
                  normalized: { $toLower: { $trim: { input: { $ifNull: ["$campaign", ""] } } } },
                },
                in: {
                  $cond: [{ $in: ["$$normalized", ["", "organic"]] }, "", "$$normalized"],
                },
              },
            },
          },
          applications: { $sum: 1 },
          interviewed: { $sum: { $cond: [{ $gt: ["$completedInterviewCount", 0] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        },
      },
    ]);

    const bySource = new Map<
      string,
      {
        source: string;
        name: string;
        applications: number;
        interviewed: number;
        approved: number;
        campaigns: Array<{
          name: string;
          applications: number;
          interviewed: number;
          approved: number;
          rate: number;
        }>;
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
        rate: row.applications ? (row.approved / row.applications) * 100 : 0,
      });
      bySource.set(sourceKey, current);
    }

    const sources = [...bySource.values()].map((row) => ({
      ...row,
      rate: row.applications ? (row.approved / row.applications) * 100 : 0,
      campaigns: row.campaigns.sort((a, b) => b.applications - a.applications),
    }));

    response.status(200).json({ data: { sources } });
  }),
);

dashboardRouter.get(
  "/upcoming-interviews",
  asyncHandler(async (request, response) => {
    const query = dashboardUpcomingQuerySchema.parse(request.query);
    const today = todayCalendarDate();
    const date = query.day === "tomorrow" ? shiftCalendarDate(today, 1) : today;

    const interviews = await Interview.aggregate<{
      id: string;
      time: string;
      label: string;
      candidateName: string;
      jobTitle: string;
    }>([
      { $match: { status: "scheduled", date } },
      { $sort: { time: 1 } },
      { $limit: 12 },
      {
        $lookup: {
          from: Application.collection.name,
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

    response.status(200).json({ data: { interviews } });
  }),
);

dashboardRouter.get(
  "/interviewers",
  asyncHandler(async (_request, response) => {
    const today = todayCalendarDate();
    const links = await DepartmentAccessLink.find({ accessDate: today }).select("token departmentId").lean();
    if (links.length === 0) {
      response.status(200).json({ data: { interviewers: [] } });
      return;
    }

    const tokens = links.map((link) => link.token);
    const [registrants, departments] = await Promise.all([
      LinkRegistrant.find({
        linkToken: { $in: tokens },
        status: { $in: ["approved", "pending_approval"] },
      })
        .select("name status linkToken requestedAt")
        .sort({ requestedAt: -1 })
        .limit(10)
        .lean(),
      Department.find({ _id: { $in: links.map((link) => link.departmentId) } })
        .select("name")
        .lean(),
    ]);

    const departmentById = new Map(departments.map((item) => [item._id.toString(), item.name]));
    const departmentByToken = new Map(
      links.map((link) => [link.token, departmentById.get(link.departmentId.toString()) ?? "Department"]),
    );

    response.status(200).json({
      data: {
        interviewers: registrants.map((item) => ({
          id: item._id.toString(),
          name: item.name,
          departmentName: departmentByToken.get(item.linkToken) ?? "Department",
          status: item.status === "approved" ? "approved" : "pending",
        })),
      },
    });
  }),
);

dashboardRouter.get(
  "/activity",
  asyncHandler(async (request, response) => {
    const query = dashboardActivityQuerySchema.parse(request.query);
    const items = await Notification.find({ targetRole: "hr" })
      .select("type title body refId createdAt")
      .sort({ createdAt: -1 })
      .limit(query.limit)
      .lean();

    response.status(200).json({
      data: {
        events: items.map((item) => ({
          id: item._id.toString(),
          type: item.type,
          title: item.title,
          body: item.body,
          href: hrefForNotification(item.type, item.refId),
          createdAt: item.createdAt.toISOString(),
        })),
      },
    });
  }),
);
