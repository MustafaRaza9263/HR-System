import { JobWizard } from "@/components/jobs/job-wizard";

interface EditJobPageProps {
  params: Promise<{ jobId: string }>;
}

export default async function EditJobPage({ params }: EditJobPageProps) {
  const { jobId } = await params;
  return <JobWizard jobId={jobId} />;
}
