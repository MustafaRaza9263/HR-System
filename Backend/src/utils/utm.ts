function readTrimmed(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function extractUtm(request: {
  body?: unknown;
  query?: unknown;
}): { source: string; campaign: string | null } {
  const body = request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
  const query = request.query && typeof request.query === "object" ? (request.query as Record<string, unknown>) : {};

  const source = (
    readTrimmed(body.utm_source, 80) ?? readTrimmed(query.utm_source, 80) ?? "website"
  ).toLowerCase();
  const campaignRaw = readTrimmed(body.utm_campaign, 120) ?? readTrimmed(query.utm_campaign, 120);
  const campaign = campaignRaw ? campaignRaw.toLowerCase() : null;

  return { source, campaign };
}
