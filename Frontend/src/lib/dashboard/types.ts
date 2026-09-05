import type { ApplicationStatus } from "@/lib/applications/types";
import type { NotificationType } from "@/lib/notifications/types";

export const DASHBOARD_STALE_TIME = 45_000;

export type DashboardJobFilter = string;
export type DashboardInterviewDay = "today" | "tomorrow";
export type TrendGranularity = "daily" | "weekly" | "monthly" | "yearly";
export type TrendChartKind = "line" | "bar";

export interface DashboardMetric {
  value: number;
  delta: number;
}

export interface DashboardSummaryResponse {
  data: {
    range: { start: string; end: string };
    openJobs: DashboardMetric;
    applications: DashboardMetric;
    interviewsToday: { value: number };
    hired: DashboardMetric;
  };
}

export interface DashboardTrendPoint {
  date: string;
  count: number;
}

export interface DashboardTrendSeries {
  id: string;
  name: string;
  points: DashboardTrendPoint[];
}

export interface DashboardTrendResponse {
  data: { series: DashboardTrendSeries[] };
}

export interface DashboardPipelineResponse {
  data: { counts: Record<ApplicationStatus, number> };
}

export interface DashboardSourceCampaign {
  name: string;
  applications: number;
  interviewed: number;
  approved: number;
  rate: number;
}

export interface DashboardSourceRow {
  source: string;
  name: string;
  applications: number;
  interviewed: number;
  approved: number;
  rate: number;
  campaigns: DashboardSourceCampaign[];
}

export interface DashboardSourcesResponse {
  data: { sources: DashboardSourceRow[] };
}

export interface DashboardUpcomingInterview {
  id: string;
  time: string;
  label: string;
  candidateName: string;
  jobTitle: string;
}

export interface DashboardUpcomingResponse {
  data: { interviews: DashboardUpcomingInterview[] };
}

export interface DashboardInterviewer {
  id: string;
  name: string;
  departmentName: string;
  status: "approved" | "pending";
}

export interface DashboardInterviewersResponse {
  data: { interviewers: DashboardInterviewer[] };
}

export interface DashboardActivityEvent {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

export interface DashboardActivityResponse {
  data: { events: DashboardActivityEvent[] };
}
