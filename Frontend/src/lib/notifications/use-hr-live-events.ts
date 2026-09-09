"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getApiBaseUrl } from "@/lib/api";
import { applyIncomingNotification } from "@/lib/notifications/cache";
import type { HrNotification } from "@/lib/notifications/types";
import { queryKeys } from "@/lib/query/query-keys";

const APPLICATIONS_INVALIDATE_DEBOUNCE_MS = 400;

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
      let incoming: HrNotification;
      try {
        incoming = JSON.parse((event as MessageEvent).data) as HrNotification;
      } catch {
        return;
      }
      applyIncomingNotification(queryClient, incoming);
      if (incoming.type === "new_application") scheduleApplicationsInvalidate();
    });

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      source.close();
    };
  }, [queryClient]);
}
