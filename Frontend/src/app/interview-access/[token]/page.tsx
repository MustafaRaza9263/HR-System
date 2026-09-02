import type { Metadata } from "next";

import { InterviewAccessPage } from "@/components/interview-access/interview-access-page";

export const metadata: Metadata = {
  title: "Interviewer Portal",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InterviewAccessPage token={token} />;
}
