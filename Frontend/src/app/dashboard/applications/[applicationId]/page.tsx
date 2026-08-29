import { ApplicationDetail } from "@/components/applications/application-detail";

interface ApplicationDetailPageProps {
  params: Promise<{ applicationId: string }>;
}

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { applicationId } = await params;
  return <ApplicationDetail applicationId={applicationId} />;
}
