export type ScoringResult = {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clipList(value: unknown, maxItems = 8, maxLength = 300) {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const text = entry.replace(/\s+/g, " ").trim();
    if (!text) continue;
    items.push(text.slice(0, maxLength));
    if (items.length >= maxItems) break;
  }
  return items;
}

function parseScore(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.min(10, Math.max(0, numeric));
  return Math.round(clamped * 10) / 10;
}

/** Keeps only score/summary/strengths/gaps. Unknown keys are dropped. */
export function sanitizeScoringResult(raw: unknown): ScoringResult | null {
  if (!isRecord(raw)) return null;
  const score = parseScore(raw.score);
  if (score === null) return null;
  const summary =
    typeof raw.summary === "string" ? raw.summary.replace(/\s+/g, " ").trim().slice(0, 2000) : "";
  if (!summary) return null;
  return {
    score,
    summary,
    strengths: clipList(raw.strengths),
    gaps: clipList(raw.gaps),
  };
}
