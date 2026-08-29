"use client";

import { useEffect } from "react";

import { alerts, type AlertTone } from "@/lib/alerts";

interface AlertBridgeProps {
  message?: string | null;
  tone?: AlertTone;
  title?: string;
  dedupeKey?: string;
  eventKey?: string | number;
}

export function AlertBridge({
  message,
  tone = "error",
  title,
  dedupeKey,
  eventKey,
}: AlertBridgeProps) {
  useEffect(() => {
    if (message) alerts[tone](message, { title, dedupeKey });
  }, [dedupeKey, eventKey, message, title, tone]);

  return null;
}
