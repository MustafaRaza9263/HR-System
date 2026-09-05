import { InterviewsManager } from "@/components/interviews/interviews-manager";
import { Suspense } from "react";

export default function InterviewsPage() {
  return (
    <Suspense fallback={<div className="min-h-full p-8" />}>
      <InterviewsManager />
    </Suspense>
  );
}
