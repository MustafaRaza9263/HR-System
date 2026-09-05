"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardCard, DashboardEmpty, DashboardSkeleton } from "@/components/dashboard/dashboard-card";
import { DashboardFilterField, DashboardFilterSheet } from "@/components/dashboard/dashboard-filter-sheet";
import { DashboardJobSelect } from "@/components/dashboard/dashboard-job-select";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { apiRequest } from "@/lib/api";
import { formatTrendLabel, TREND_RANGE_LABEL } from "@/lib/dashboard/format";
import {
  DASHBOARD_STALE_TIME,
  type DashboardJobFilter,
  type DashboardTrendResponse,
  type TrendChartKind,
  type TrendGranularity,
} from "@/lib/dashboard/types";
import { queryKeys } from "@/lib/query/query-keys";

const TREND_COLOR = "#4f46e5";
const SERIES_COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626", "#0891b2", "#7c3aed", "#be123c", "#2563eb"];
const TREND_MARGIN = { top: 10, right: 12, left: -18, bottom: 0 };
const GRANULARITY_OPTIONS: DropdownOption[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

interface ApplicationsTrendCardProps {
  jobOptions: DropdownOption[];
}

interface ChartRow {
  dateKey: string;
  label: string;
  [seriesId: string]: string | number;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((entry) => Number(entry.value ?? 0) > 0 || payload.length === 1);
  const rows = visible.length > 0 ? visible : payload;
  return (
    <div className="max-w-xs rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-xl dark:border-gray-700 dark:bg-gray-950">
      <p className="mb-1.5 font-bold text-gray-900 dark:text-white">{label}</p>
      <div className="space-y-1">
        {rows.map((entry) => (
          <div className="flex items-center justify-between gap-4" key={String(entry.dataKey ?? entry.name)}>
            <span className="truncate font-semibold" style={{ color: entry.color }}>
              {entry.name}
            </span>
            <span className="shrink-0 font-bold text-gray-900 dark:text-white">{Number(entry.value ?? 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendDot({
  cx,
  cy,
  payload,
  dataKey,
  fill,
}: {
  cx?: number;
  cy?: number;
  payload?: Record<string, string | number>;
  dataKey?: string;
  fill?: string;
}) {
  const key = dataKey ?? "total";
  const value = Number(payload?.[key] ?? 0);
  if (!value || cx == null || cy == null) return null;
  const color = fill ?? TREND_COLOR;
  return <circle cx={cx} cy={cy} fill={color} r={2.5} stroke={color} />;
}

function TrendActiveDot({
  cx,
  cy,
  payload,
  dataKey,
  fill,
}: {
  cx?: number;
  cy?: number;
  payload?: Record<string, string | number>;
  dataKey?: string;
  fill?: string;
}) {
  const key = dataKey ?? "total";
  const value = Number(payload?.[key] ?? 0);
  if (!value || cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} fill={fill ?? TREND_COLOR} r={5} stroke="white" strokeWidth={1.5} />;
}

export function ApplicationsTrendCard({ jobOptions }: ApplicationsTrendCardProps) {
  const [job, setJob] = useState<DashboardJobFilter>("all");
  const [granularity, setGranularity] = useState<TrendGranularity>("daily");
  const [chartKind, setChartKind] = useState<TrendChartKind>("line");

  const trendOptions = useMemo<DropdownOption[]>(() => {
    const openIndex = jobOptions.findIndex((option) => option.value === "open");
    const compareOption = { value: "compare", label: "Compare open jobs" };
    if (openIndex < 0) return [...jobOptions, compareOption];
    return [...jobOptions.slice(0, openIndex + 1), compareOption, ...jobOptions.slice(openIndex + 1)];
  }, [jobOptions]);

  const trendQuery = useQuery({
    queryKey: queryKeys.dashboard.trend(job, granularity),
    queryFn: async () =>
      apiRequest<DashboardTrendResponse>(
        `/dashboard/trend?job=${encodeURIComponent(job)}&granularity=${encodeURIComponent(granularity)}`,
      ),
    staleTime: DASHBOARD_STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const series = useMemo(
    () =>
      (trendQuery.data?.data.series ?? []).map((item, index) => ({
        ...item,
        color: SERIES_COLORS[index % SERIES_COLORS.length]!,
      })),
    [trendQuery.data?.data.series],
  );

  const rows = useMemo(() => {
    const first = series[0];
    if (!first) return [];
    return first.points.map((point, index) => {
      const row: ChartRow = { dateKey: point.date, label: formatTrendLabel(point.date, granularity) };
      for (const item of series) {
        row[item.id] = item.points[index]?.count ?? 0;
      }
      return row;
    });
  }, [granularity, series]);

  const comparing = series.length > 1;
  const hasValues = rows.some((row) => series.some((item) => Number(row[item.id] ?? 0) > 0));
  const tickInterval = granularity === "daily" ? undefined : 0;

  return (
    <DashboardCard
      actions={
        <DashboardFilterSheet
          desktop={
            <>
              <DashboardJobSelect className="w-52" onChange={setJob} options={trendOptions} value={job} />
              <Dropdown
                aria-label="Trend grouping"
                className="w-32"
                onChange={(value) => setGranularity(value as TrendGranularity)}
                options={GRANULARITY_OPTIONS}
                size="sm"
                value={granularity}
              />
              <button
                aria-label={chartKind === "line" ? "Switch to bar chart" : "Switch to line chart"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                onClick={() => setChartKind((value) => (value === "line" ? "bar" : "line"))}
                title={chartKind === "line" ? "Switch to bar chart" : "Switch to line chart"}
                type="button"
              >
                {chartKind === "line" ? <BarChart3 className="h-4 w-4" /> : <LineChartIcon className="h-4 w-4" />}
              </button>
            </>
          }
          title="Trend filters"
        >
          <DashboardFilterField label="Job">
            <DashboardJobSelect className="w-full" onChange={setJob} options={trendOptions} size="md" value={job} />
          </DashboardFilterField>
          <DashboardFilterField label="View">
            <Dropdown
              aria-label="Trend grouping"
              className="w-full"
              onChange={(value) => setGranularity(value as TrendGranularity)}
              options={GRANULARITY_OPTIONS}
              size="md"
              value={granularity}
            />
          </DashboardFilterField>
          <DashboardFilterField label="Chart">
            <div className="grid grid-cols-2 gap-2">
              {(["line", "bar"] as const).map((kind) => (
                <button
                  className={`h-12 rounded-xl border text-sm font-bold ${
                    chartKind === kind
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  }`}
                  key={kind}
                  onClick={() => setChartKind(kind)}
                  type="button"
                >
                  {kind === "line" ? "Line" : "Bar"}
                </button>
              ))}
            </div>
          </DashboardFilterField>
        </DashboardFilterSheet>
      }
      className="h-[440px]"
      subtitle={`Applications received · ${TREND_RANGE_LABEL[granularity]}`}
      title="Applications trend"
    >
      <div className="flex h-full min-h-0 flex-col [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
        {trendQuery.isPending && !trendQuery.data ? (
          <DashboardSkeleton />
        ) : !hasValues ? (
          <DashboardEmpty>No applications in the {TREND_RANGE_LABEL[granularity].toLowerCase()}.</DashboardEmpty>
        ) : (
          <>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer height="100%" width="100%">
                {chartKind === "line" && !comparing ? (
                  <AreaChart accessibilityLayer={false} data={rows} margin={TREND_MARGIN}>
                    <defs>
                      <linearGradient id="applications-trend-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={series[0]?.color ?? TREND_COLOR} stopOpacity={0.32} />
                        <stop offset="70%" stopColor={series[0]?.color ?? TREND_COLOR} stopOpacity={0.06} />
                        <stop offset="100%" stopColor={series[0]?.color ?? TREND_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid className="stroke-gray-200 dark:stroke-gray-800" strokeDasharray="3 3" vertical={false} />
                    <XAxis axisLine={false} dataKey="label" interval={tickInterval} minTickGap={18} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} width={36} />
                    <Tooltip content={<TrendTooltip />} wrapperStyle={{ zIndex: 100 }} />
                    <Area
                      activeDot={(props) => (
                        <TrendActiveDot
                          cx={props.cx}
                          cy={props.cy}
                          dataKey={series[0]?.id}
                          fill={series[0]?.color}
                          payload={props.payload}
                        />
                      )}
                      dataKey={series[0]?.id ?? "total"}
                      dot={(props) => (
                        <TrendDot
                          cx={props.cx}
                          cy={props.cy}
                          dataKey={series[0]?.id}
                          fill={series[0]?.color}
                          payload={props.payload}
                        />
                      )}
                      fill="url(#applications-trend-fill)"
                      fillOpacity={1}
                      name={series[0]?.name ?? "Applications"}
                      stroke={series[0]?.color ?? TREND_COLOR}
                      strokeWidth={2.4}
                      type="monotone"
                    />
                  </AreaChart>
                ) : chartKind === "line" ? (
                  <LineChart accessibilityLayer={false} data={rows} margin={TREND_MARGIN}>
                    <CartesianGrid className="stroke-gray-200 dark:stroke-gray-800" strokeDasharray="3 3" vertical={false} />
                    <XAxis axisLine={false} dataKey="label" interval={tickInterval} minTickGap={18} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} width={36} />
                    <Tooltip content={<TrendTooltip />} wrapperStyle={{ zIndex: 100 }} />
                    {series.map((item) => (
                      <Line
                        activeDot={(props) => (
                          <TrendActiveDot cx={props.cx} cy={props.cy} dataKey={item.id} fill={item.color} payload={props.payload} />
                        )}
                        dataKey={item.id}
                        dot={(props) => (
                          <TrendDot cx={props.cx} cy={props.cy} dataKey={item.id} fill={item.color} payload={props.payload} />
                        )}
                        key={item.id}
                        name={item.name}
                        stroke={item.color}
                        strokeWidth={2.2}
                        type="monotone"
                      />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart accessibilityLayer={false} data={rows} margin={TREND_MARGIN}>
                    <CartesianGrid className="stroke-gray-200 dark:stroke-gray-800" strokeDasharray="3 3" vertical={false} />
                    <XAxis axisLine={false} dataKey="label" interval={tickInterval} minTickGap={18} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} width={36} />
                    <Tooltip content={<TrendTooltip />} cursor={false} wrapperStyle={{ zIndex: 100 }} />
                    {series.map((item) => (
                      <Bar dataKey={item.id} fill={item.color} key={item.id} maxBarSize={comparing ? 14 : 26} name={item.name} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {comparing ? (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {series.map((item) => (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300" key={item.id}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="max-w-36 truncate">{item.name}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </DashboardCard>
  );
}
