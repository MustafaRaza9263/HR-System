import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function ConfigurationBackLink() {
  return (
    <div className="w-full bg-gray-50 px-4 pt-4 sm:px-6 sm:pt-6 md:px-8 md:pt-8 dark:bg-gray-900">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        href="/dashboard/configuration"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Back to Configurations
      </Link>
    </div>
  );
}
