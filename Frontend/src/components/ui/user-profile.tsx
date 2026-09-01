interface UserProfileProps {
  name: string;
  email: string;
  className?: string;
}

function getInitials(name: string) {
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

export function UserProfile({ name, email, className }: UserProfileProps) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className ?? ""}`}>
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-[#2a2150] dark:text-indigo-300"
      >
        {getInitials(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-gray-950 dark:text-white">{name}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
      </div>
    </div>
  );
}
