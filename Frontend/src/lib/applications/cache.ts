import type { QueryClient } from "@tanstack/react-query";

import { applicationsListIsScoreScoped, queryKeys } from "@/lib/query/query-keys";

import type { ApplicationDetailResponse, ApplicationScoring, ApplicationsListResponse } from "./types";

export function applyApplicationScoring(
  queryClient: QueryClient,
  applicationId: string,
  scoring: ApplicationScoring,
) {
  const scoringStatus =
    scoring.status === "pending" || scoring.status === "completed" || scoring.status === "failed"
      ? scoring.status
      : null;

  queryClient.setQueriesData<ApplicationsListResponse>({ queryKey: ["applications", "list"] }, (current) => {
    if (!current) return current;
    let changed = false;
    const applications = current.data.applications.map((row) => {
      if (row.id !== applicationId) return row;
      changed = true;
      return { ...row, score: scoring.score, scoringStatus };
    });
    if (!changed) return current;
    return { data: { ...current.data, applications } };
  });

  queryClient.setQueryData<ApplicationDetailResponse>(queryKeys.applications.detail(applicationId), (current) => {
    if (!current) return current;
    return {
      data: {
        application: {
          ...current.data.application,
          scoring,
        },
      },
    };
  });

  void queryClient.invalidateQueries({
    predicate: (query) => applicationsListIsScoreScoped(query.queryKey),
  });
}
