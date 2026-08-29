import { JobDetail } from "@/components/jobs/job-detail";

interface JobDetailPageProps {
  params: Promise<{ jobId: string }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params;
  return <JobDetail jobId={jobId} />;
}
