import { InterviewsManager } from "@/components/interviews/interviews-manager";
import { Suspense } from "react";

export default function InterviewsPage() {
  return (
    <Suspense fallback={<div className="min-h-full bg-gray-50 p-8 dark:bg-gray-900" />}>
      <InterviewsManager />
    </Suspense>
  );
}
