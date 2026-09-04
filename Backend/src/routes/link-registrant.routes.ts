import { Router } from "express";

import { authenticate } from "../middleware/authenticate.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { Department } from "../models/department.model.js";
import { DepartmentAccessLink } from "../models/department-access-link.model.js";
import { LinkRegistrant } from "../models/link-registrant.model.js";
import { sendAccessApprovedEmail, sendAccessRejectedEmail } from "../services/email/index.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { isAccessDateExpired } from "../utils/date-state.js";
import { assertObjectId } from "../utils/object-id.js";
import { accessUrl } from "./department-link.routes.js";

export const linkRegistrantRouter = Router();

function serializeRegistrant(item: {
  _id: { toString(): string };
  linkToken: string;
  name: string;
  email: string;
  status: string;
  requestedAt: Date;
  approvedAt?: Date | null;
}) {
  return {
    id: item._id.toString(),
    token: item.linkToken,
    name: item.name,
    email: item.email,
    status: item.status,
    requestedAt: item.requestedAt,
    approvedAt: item.approvedAt ?? null,
  };
}

async function loadPendingRegistrant(id: string) {
  assertObjectId(id, "REGISTRANT_NOT_FOUND", "Registrant was not found.");
  const registrant = await LinkRegistrant.findById(id);
  if (!registrant) {
    throw new ApiError(404, "REGISTRANT_NOT_FOUND", "Registrant was not found.");
  }
  const link = await DepartmentAccessLink.findOne({ token: registrant.linkToken });
  if (!link) {
    throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
  }
  if (isAccessDateExpired(link.accessDate)) {
    throw new ApiError(410, "LINK_EXPIRED", "This link has expired.");
  }
  return { registrant, link };
}

linkRegistrantRouter.use(authenticate);

linkRegistrantRouter.patch(
  "/:id/approve",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const id = request.params.id;
    if (typeof id !== "string") {
      throw new ApiError(404, "REGISTRANT_NOT_FOUND", "Registrant was not found.");
    }
    const { registrant, link } = await loadPendingRegistrant(id);
    if (registrant.status !== "pending_approval") {
      throw new ApiError(409, "REGISTRANT_NOT_PENDING", "This request is not waiting for approval.");
    }

    registrant.status = "approved";
    registrant.approvedAt = new Date();
    await registrant.save();

    const department = await Department.findById(link.departmentId).select("name").lean();
    sendAccessApprovedEmail({
      to: registrant.email,
      name: registrant.name,
      accessUrl: accessUrl(link.token),
      departmentName: department?.name ?? "the department",
    });

    response.status(200).json({ data: { registrant: serializeRegistrant(registrant.toObject()) } });
  }),
);

linkRegistrantRouter.patch(
  "/:id/reject",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const id = request.params.id;
    if (typeof id !== "string") {
      throw new ApiError(404, "REGISTRANT_NOT_FOUND", "Registrant was not found.");
    }
    const { registrant, link } = await loadPendingRegistrant(id);
    if (registrant.status !== "pending_approval") {
      throw new ApiError(409, "REGISTRANT_NOT_PENDING", "This request is not waiting for approval.");
    }

    registrant.status = "rejected";
    await registrant.save();

    const department = await Department.findById(link.departmentId).select("name").lean();
    sendAccessRejectedEmail({
      to: registrant.email,
      name: registrant.name,
      departmentName: department?.name ?? "the department",
    });

    response.status(200).json({ data: { registrant: serializeRegistrant(registrant.toObject()) } });
  }),
);

linkRegistrantRouter.patch(
  "/:id/revoke",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const id = request.params.id;
    if (typeof id !== "string") {
      throw new ApiError(404, "REGISTRANT_NOT_FOUND", "Registrant was not found.");
    }
    assertObjectId(id, "REGISTRANT_NOT_FOUND", "Registrant was not found.");
    const registrant = await LinkRegistrant.findById(id);
    if (!registrant) {
      throw new ApiError(404, "REGISTRANT_NOT_FOUND", "Registrant was not found.");
    }
    if (registrant.status !== "approved") {
      throw new ApiError(409, "REGISTRANT_NOT_APPROVED", "Only an approved registrant can be revoked.");
    }

    registrant.status = "revoked";
    await registrant.save();

    response.status(200).json({ data: { registrant: serializeRegistrant(registrant.toObject()) } });
  }),
);
