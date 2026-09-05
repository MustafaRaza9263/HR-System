import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";

interface DashboardJobSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  className?: string;
  size?: "sm" | "md";
}

export function DashboardJobSelect({ value, onChange, options, className, size = "sm" }: DashboardJobSelectProps) {
  return (
    <Dropdown
      aria-label="Filter by job"
      className={className ?? "w-40"}
      onChange={onChange}
      options={options}
      size={size}
      value={value}
    />
  );
}
