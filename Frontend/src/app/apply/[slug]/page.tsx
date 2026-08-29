import type { Metadata } from "next";

import { ApplyJobPage } from "@/components/careers/apply-job-page";

interface ApplyPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Apply",
  description: "Apply for an open role.",
};

export default async function ApplyRoutePage({ params }: ApplyPageProps) {
  const { slug } = await params;
  return <ApplyJobPage slug={slug} />;
}
