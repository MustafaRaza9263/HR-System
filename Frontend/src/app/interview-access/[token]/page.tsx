import { InterviewAccessPage } from "@/components/interview-access/interview-access-page";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-svh bg-gray-50 px-4 py-10 text-gray-900 dark:bg-gray-950 dark:text-white">
      <InterviewAccessPage token={token} />
    </main>
  );
}
