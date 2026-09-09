export function ScorePendingShimmer({ className }: { className?: string }) {
  return (
    <span
      aria-label="Scoring in progress"
      className={`score-pending-shimmer ${className ?? ""}`.trim()}
      role="status"
    />
  );
}
