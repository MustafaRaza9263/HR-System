"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getApiBaseUrl } from "@/lib/api";
import { applyApplicationScoring } from "@/lib/applications/cache";
import type { ApplicationScoredEvent } from "@/lib/applications/types";
import { applyIncomingNotification } from "@/lib/notifications/cache";
import type { HrNotification } from "@/lib/notifications/types";
import { queryKeys } from "@/lib/query/query-keys";

const APPLICATIONS_INVALIDATE_DEBOUNCE_MS = 400;

function parseEventData<T>(event: Event): T | null {
  try {
    return JSON.parse((event as MessageEvent).data) as T;
  } catch {
    return null;
  }
}

export function useHrLiveEvents() {
  const queryClient = useQueryClient();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const source = new EventSource(`${getApiBaseUrl()}/notifications/stream`, { withCredentials: true });

    function scheduleApplicationsInvalidate() {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
      }, APPLICATIONS_INVALIDATE_DEBOUNCE_MS);
    }

    source.addEventListener("notification", (event) => {
      const incoming = parseEventData<HrNotification>(event);
      if (!incoming) return;
      applyIncomingNotification(queryClient, incoming);
      if (incoming.type === "new_application") scheduleApplicationsInvalidate();
    });

    source.addEventListener("application.scored", (event) => {
      const incoming = parseEventData<ApplicationScoredEvent>(event);
      if (!incoming?.id) return;
      const { id, ...scoring } = incoming;
      applyApplicationScoring(queryClient, id, {
        status: scoringStatus(scoring.status),
        score: typeof scoring.score === "number" ? scoring.score : null,
        summary: scoring.summary ?? null,
        strengths: Array.isArray(scoring.strengths) ? scoring.strengths : [],
        gaps: Array.isArray(scoring.gaps) ? scoring.gaps : [],
        provider: scoring.provider ?? null,
        model: scoring.model ?? null,
        linksAttempted: scoring.linksAttempted ?? 0,
        linksUsed: scoring.linksUsed ?? 0,
        scoredAt: scoring.scoredAt ?? null,
      });
    });

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      source.close();
    };
  }, [queryClient]);
}

function scoringStatus(value: unknown) {
  if (value === "pending" || value === "completed" || value === "failed") return value;
  return null;
}
