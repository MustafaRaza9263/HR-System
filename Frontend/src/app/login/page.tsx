import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrentUser } from "@/lib/server-api";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#f5f7fb] px-5 py-16 dark:bg-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,0.15),transparent_40%)] dark:bg-[radial-gradient(circle_at_50%_-10%,rgba(148,163,184,0.09),transparent_42%)]" />
      <div className="absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-700/10" />
      <div className="absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-700/10" />

      <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500" href="/">
          <BrandMark />
        </Link>
        <ThemeToggle />
      </div>

      <section className="relative w-full max-w-[440px] rounded-[28px] border border-white/80 bg-white/95 px-7 py-9 shadow-[0_24px_70px_rgba(30,41,59,0.12)] backdrop-blur sm:px-10 sm:py-11 dark:border-white/10 dark:bg-slate-900/95 dark:shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
        <div className="mx-auto w-fit">
          <BrandMark compact />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-600 dark:text-indigo-300">Authorized HR access</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">Welcome back</h1>
          <p className="mt-2 text-[15px] leading-6 text-slate-500 dark:text-slate-400">Sign in to manage your people and hiring workspace.</p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          New to HR System?{" "}
          <Link className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300" href="/register">
            Create an account
          </Link>
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <ShieldCheck aria-hidden className="h-4 w-4" />
          Secure access for authorized HR staff
        </div>

        <Link className="mx-auto mt-5 flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:text-indigo-300" href="/">
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </section>
    </main>
  );
}
