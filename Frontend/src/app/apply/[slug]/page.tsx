import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";

interface ApplyPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Apply",
  description: "Job application",
};

export default async function ApplyPlaceholderPage({ params }: ApplyPageProps) {
  const { slug } = await params;

  return (
    <main className="flex min-h-svh flex-col bg-[#f7f7f5] text-neutral-900 dark:bg-gray-950 dark:text-white">
      <header className="border-b border-neutral-200/80 dark:border-gray-800">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
          <Link aria-label="Careers home" href="/">
            <BrandMark />
          </Link>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16 text-center sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Application</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em]">Coming soon</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          Candidate applications for <span className="font-semibold text-neutral-800 dark:text-neutral-200">{slug}</span> are not open in this release yet. Browse other open roles from the careers page.
        </p>
        <Link
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white dark:bg-white dark:text-neutral-950"
          href="/"
        >
          Back to open roles
        </Link>
      </div>
    </main>
  );
}
