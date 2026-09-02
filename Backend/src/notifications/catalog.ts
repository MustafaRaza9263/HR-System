import { Application } from "../models/application.model.js";
import { Department } from "../models/department.model.js";
import { DepartmentAccessLink } from "../models/department-access-link.model.js";
import { Interview } from "../models/interview.model.js";
import { LinkRegistrant } from "../models/link-registrant.model.js";
import type { NotificationType } from "../models/notification.model.js";

export interface NotificationContent {
  title: string;
  body: string;
  href: string;
}

type ContentBuilder = (refId: string) => Promise<NotificationContent>;

/**
 * Add a builder here (and the matching value in NOTIFICATION_TYPES) to introduce
 * a new HR notification. `notifyHR(type, refId)` remains the only insert path.
 */
const builders: Record<NotificationType, ContentBuilder> = {
  new_application: async (refId) => {
    const application = await Application.findById(refId).select("candidateName roleSnapshot").lean();
    const name = application?.candidateName ?? "A candidate";
    const title = application?.roleSnapshot.title ?? "a role";
    return {
      title: "New application",
      body: `${name} applied for ${title}.`,
      href: `/dashboard/applications/${refId}`,
    };
  },
  interview_request: async (refId) => {
    const registrant = refId.length === 24 ? await LinkRegistrant.findById(refId).lean() : null;
    const link = registrant
      ? await DepartmentAccessLink.findOne({ token: registrant.linkToken }).lean()
      : await DepartmentAccessLink.findOne({ token: refId }).lean();
    const department = link
      ? await Department.findById(link.departmentId).select("name").lean()
      : null;
    const person = registrant?.name ?? "Someone";
    const departmentName = department?.name ?? "a department";
    return {
      title: "Interview access request",
      body: `${person} requested access to today's ${departmentName} interviews.`,
      href: "/dashboard/interviews?pending=1",
    };
  },
  interview_completed: async (refId) => {
    const [interviewId, registrantId] = refId.split(":");
    const interview = interviewId ? await Interview.findById(interviewId).select("applicationId").lean() : null;
    const application = interview
      ? await Application.findById(interview.applicationId).select("candidateName roleSnapshot").lean()
      : null;
    const registrant =
      registrantId && registrantId.length === 24 ? await LinkRegistrant.findById(registrantId).select("name").lean() : null;
    const interviewer = registrant?.name?.trim() || "An interviewer";
    const candidate = application?.candidateName?.trim() || "a candidate";
    const title = application?.roleSnapshot.title?.trim() || "a role";
    const department = application?.roleSnapshot.departmentName?.trim();
    const roleStuff = department && department !== title ? `${title} · ${department}` : title;
    return {
      title: "Interview completed",
      body: `${interviewer} completed interview with ${candidate} for ${roleStuff}.`,
      href: "/dashboard/interviews",
    };
  },
};

export function hrefForNotification(type: NotificationType, refId: string): string {
  if (type === "new_application") return `/dashboard/applications/${refId}`;
  if (type === "interview_completed") return "/dashboard/interviews";
  return "/dashboard/interviews?pending=1";
}

export async function resolveNotificationContent(
  type: NotificationType,
  refId: string,
): Promise<NotificationContent> {
  return builders[type](refId);
}
