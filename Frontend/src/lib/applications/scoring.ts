export type ScoringStatus = "pending" | "completed" | "failed";

export const SCORE_RANGE_OPTIONS = [
  { value: "", label: "All scores" },
  { value: "lt4", label: "Below 4" },
  { value: "4-7", label: "4 – 6.9" },
  { value: "gte7", label: "7 – 10" },
];

export function scoreRangeParams(range: string): {
  scoreMin?: number;
  scoreMax?: number;
  scoreLessThan?: number;
} {
  if (range === "lt4") return { scoreLessThan: 4 };
  if (range === "4-7") return { scoreMin: 4, scoreMax: 6.9 };
  if (range === "gte7") return { scoreMin: 7 };
  return {};
}

export function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 7) return "success";
  if (score >= 4) return "warning";
  return "danger";
}

export function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
