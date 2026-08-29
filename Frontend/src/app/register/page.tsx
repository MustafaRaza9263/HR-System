import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrentUser } from "@/lib/server-api";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#f5f7fb] px-5 py-24 dark:bg-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,0.15),transparent_40%)]" />
      <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/"><BrandMark /></Link>
        <ThemeToggle />
      </div>

      <section className="relative w-full max-w-[460px] rounded-[28px] border border-white/80 bg-white/95 px-7 py-9 shadow-[0_24px_70px_rgba(30,41,59,0.12)] backdrop-blur sm:px-10 dark:border-white/10 dark:bg-slate-900/95">
        <div className="mx-auto w-fit"><BrandMark compact /></div>
        <div className="mt-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-600 dark:text-indigo-300">HR registration</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">Create your account</h1>
          <p className="mt-2 text-[15px] leading-6 text-slate-500 dark:text-slate-400">Get immediate access to your hiring workspace.</p>
        </div>

        <RegisterForm />

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Already registered? <Link className="font-semibold text-indigo-600 dark:text-indigo-300" href="/login">Sign in</Link>
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400 dark:border-slate-800">
          <ShieldCheck aria-hidden className="h-4 w-4" /> Passwords are securely hashed
        </div>
        <Link className="mx-auto mt-5 flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600" href="/">
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to home
        </Link>
      </section>
    </main>
  );
}
