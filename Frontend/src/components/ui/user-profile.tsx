interface UserProfileProps {
  name: string;
  email: string;
  className?: string;
  size?: "sm" | "md";
}

export function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function UserProfile({ name, email, className, size = "md" }: UserProfileProps) {
  const compact = size === "sm";
  return (
    <div className={`flex min-w-0 items-center ${compact ? "gap-1.5" : "gap-2.5"} ${className ?? ""}`}>
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-700 dark:bg-[#2a2150] dark:text-indigo-300 ${
          compact ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs"
        }`}
      >
        {getInitials(name)}
      </span>
      <div className="min-w-0">
        <p className={`truncate font-bold text-gray-950 dark:text-white ${compact ? "text-xs" : "text-sm"}`}>{name}</p>
        <p className={`truncate text-gray-500 dark:text-gray-400 ${compact ? "text-[10px] leading-tight" : "mt-0.5 text-xs"}`}>
          {email}
        </p>
      </div>
    </div>
  );
}
