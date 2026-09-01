import { Router } from "express";

import { env } from "../config/env.js";
import { authenticate } from "../middleware/authenticate.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { Department } from "../models/department.model.js";
import { DepartmentAccessLink } from "../models/department-access-link.model.js";
import { LinkRegistrant } from "../models/link-registrant.model.js";
import {
  createDepartmentLinkSchema,
  listDepartmentLinksQuerySchema,
  sendDepartmentLinkEmailSchema,
} from "../schemas/interview.schema.js";
import { sendAccessInviteEmail } from "../services/email.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { isAccessDateExpired, todayCalendarDate } from "../utils/date-state.js";
import { assertObjectId } from "../utils/object-id.js";
import { generateRawToken } from "../utils/token.js";

export const departmentLinkRouter = Router();

export function accessUrl(token: string) {
  return `${env.FRONTEND_URL}/interview-access/${token}`;
}

function isDuplicateKey(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

function serializeLink(link: {
  token: string;
  departmentId: { toString(): string };
  accessDate: string;
  createdAt: Date;
}) {
  return {
    token: link.token,
    departmentId: link.departmentId.toString(),
    accessDate: link.accessDate,
    url: accessUrl(link.token),
    expired: isAccessDateExpired(link.accessDate),
    createdAt: link.createdAt,
  };
}

function emptyCounts() {
  return { pending: 0, approved: 0, rejected: 0, revoked: 0 };
}

function requesterCounts(rows: Array<{ status: string }>) {
  const counts = emptyCounts();
  for (const row of rows) {
    if (row.status === "pending_approval") counts.pending += 1;
    else if (row.status === "approved") counts.approved += 1;
    else if (row.status === "rejected") counts.rejected += 1;
    else if (row.status === "revoked") counts.revoked += 1;
  }
  return counts;
}

async function sendInvite(token: string, email: string) {
  const link = await DepartmentAccessLink.findOne({ token }).lean();
  if (!link) {
    throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
  }
  const department = await Department.findById(link.departmentId).select("name").lean();
  await sendAccessInviteEmail({
    to: email.toLowerCase(),
    accessUrl: accessUrl(link.token),
    departmentName: department?.name ?? "the department",
  });
}

departmentLinkRouter.use(authenticate);

departmentLinkRouter.post(
  "/",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const input = createDepartmentLinkSchema.parse(request.body);
    assertObjectId(input.departmentId, "DEPARTMENT_NOT_FOUND", "Department was not found.");
    const department = await Department.findById(input.departmentId);
    if (!department) {
      throw new ApiError(404, "DEPARTMENT_NOT_FOUND", "Department was not found.");
    }

    const accessDate = todayCalendarDate();
    let link = await DepartmentAccessLink.findOne({ departmentId: department._id, accessDate });
    let created = false;

    if (!link) {
      try {
        link = await DepartmentAccessLink.create({
          token: generateRawToken(),
          departmentId: department._id,
          accessDate,
          createdBy: request.auth!.user.id,
        });
        created = true;
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        link = await DepartmentAccessLink.findOne({ departmentId: department._id, accessDate });
        if (!link) throw error;
      }
    }

    if (input.email) {
      await sendInvite(link.token, input.email);
    }

    response.status(created ? 201 : 200).json({
      data: { link: { ...serializeLink(link.toObject()), requesters: emptyCounts() } },
    });
  }),
);

departmentLinkRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const input = listDepartmentLinksQuerySchema.parse(request.query);
    const departmentId = input.departmentId ?? input.department_id;
    const filter: Record<string, unknown> = {};
    if (input.date) filter.accessDate = input.date;
    if (departmentId) {
      assertObjectId(departmentId, "DEPARTMENT_NOT_FOUND", "Department was not found.");
      filter.departmentId = departmentId;
    }

    const links = await DepartmentAccessLink.find(filter).sort({ accessDate: -1, createdAt: -1 }).limit(100).lean();
    const departmentIds = [...new Set(links.map((item) => item.departmentId.toString()))];
    const departments = await Department.find({ _id: { $in: departmentIds } }).select("name").lean();
    const names = new Map(departments.map((item) => [item._id.toString(), item.name]));

    const tokens = links.map((item) => item.token);
    const registrants = await LinkRegistrant.find({ linkToken: { $in: tokens } }).select("linkToken status").lean();
    const byToken = new Map<string, Array<{ status: string }>>();
    for (const row of registrants) {
      const current = byToken.get(row.linkToken) ?? [];
      current.push(row);
      byToken.set(row.linkToken, current);
    }

    response.status(200).json({
      data: {
        links: links.map((link) => ({
          ...serializeLink(link),
          departmentName: names.get(link.departmentId.toString()) ?? "Department",
          requesters: requesterCounts(byToken.get(link.token) ?? []),
        })),
      },
    });
  }),
);

departmentLinkRouter.get(
  "/pending",
  asyncHandler(async (_request, response) => {
    const today = todayCalendarDate();
    const todayLinks = await DepartmentAccessLink.find({ accessDate: today }).select("token departmentId").lean();
    const tokens = todayLinks.map((item) => item.token);
    const requests = await LinkRegistrant.find({
      linkToken: { $in: tokens },
      status: "pending_approval",
    })
      .sort({ requestedAt: 1 })
      .lean();

    const departmentByToken = new Map(
      todayLinks.map((item) => [item.token, item.departmentId.toString()] as const),
    );
    const departmentIds = [...new Set(todayLinks.map((item) => item.departmentId.toString()))];
    const departments = await Department.find({ _id: { $in: departmentIds } }).select("name").lean();
    const names = new Map(departments.map((item) => [item._id.toString(), item.name]));

    response.status(200).json({
      data: {
        requests: requests.map((item) => ({
          id: item._id.toString(),
          token: item.linkToken,
          name: item.name,
          email: item.email,
          departmentName: names.get(departmentByToken.get(item.linkToken) ?? "") ?? "Department",
          requestedAt: item.requestedAt,
        })),
      },
    });
  }),
);

departmentLinkRouter.get(
  "/:token/registrants",
  asyncHandler(async (request, response) => {
    const token = request.params.token;
    if (typeof token !== "string") {
      throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
    }
    const link = await DepartmentAccessLink.findOne({ token }).lean();
    if (!link) {
      throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
    }
    const registrants = await LinkRegistrant.find({ linkToken: token }).sort({ requestedAt: 1 }).lean();
    response.status(200).json({
      data: {
        registrants: registrants.map((item) => ({
          id: item._id.toString(),
          token: item.linkToken,
          name: item.name,
          email: item.email,
          status: item.status,
          requestedAt: item.requestedAt,
          approvedAt: item.approvedAt ?? null,
        })),
      },
    });
  }),
);

departmentLinkRouter.post(
  "/:token/send-email",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const token = request.params.token;
    if (typeof token !== "string") {
      throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
    }
    const input = sendDepartmentLinkEmailSchema.parse(request.body);
    const link = await DepartmentAccessLink.findOne({ token }).lean();
    if (!link) {
      throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
    }
    await sendInvite(token, input.email);
    response.status(200).json({ data: { sent: true } });
  }),
);
