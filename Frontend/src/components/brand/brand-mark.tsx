import { UsersRound } from "lucide-react";

interface BrandMarkProps {
  compact?: boolean;
  inverse?: boolean;
}

export function BrandMark({ compact = false, inverse = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)]">
        <UsersRound aria-hidden className="h-5 w-5" strokeWidth={2.2} />
      </span>
      {compact ? null : (
        <span className={`text-[15px] font-bold tracking-[-0.02em] ${inverse ? "text-white" : "text-slate-900 dark:text-white"}`}>
          HR System
        </span>
      )}
    </div>
  );
}
