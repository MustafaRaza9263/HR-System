import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Check,
  FileText,
  Gauge,
  Layers3,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrentUser } from "@/lib/server-api";

const capabilities = [
  {
    icon: Layers3,
    title: "Structured organization",
    description: "Model departments, roles, and custom hiring fields around the way your team already works.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Better job operations",
    description: "Create complete job profiles with requirements, pay ranges, and clear ownership in one place.",
  },
  {
    icon: Gauge,
    title: "Consistent candidate scoring",
    description: "Give every applicant a fair, repeatable review with transparent scoring criteria.",
  },
  {
    icon: FileText,
    title: "Faster applications",
    description: "Reduce candidate effort with resume-assisted application forms and structured submissions.",
  },
  {
    icon: Bot,
    title: "Answers on demand",
    description: "Help candidates and HR teams find the right information through an integrated assistant.",
  },
  {
    icon: ShieldCheck,
    title: "Controlled HR access",
    description: "Keep administration private with secure accounts and server-side protected workspaces.",
  },
] as const;

const workflow = [
  { number: "01", title: "Shape your structure", description: "Define departments, roles, fields, and hiring standards." },
  { number: "02", title: "Publish the opportunity", description: "Build a complete job and share a focused candidate experience." },
  { number: "03", title: "Review with confidence", description: "Score applicants consistently and move the best people forward." },
] as const;

export default async function HomePage() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/dashboard" : "/login";
  const primaryLabel = user ? "Dashboard" : "HR sign in";

  return (
    <main className="min-h-svh overflow-hidden bg-white text-slate-900 dark:bg-gray-950 dark:text-white">
      <header className="relative z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/85">
        <div className="mx-auto flex h-18 max-w-7xl items-center px-5 sm:px-8 lg:px-10">
          <Link aria-label="HR System home" href="/">
            <BrandMark />
          </Link>
          <nav className="ml-auto flex items-center gap-2 sm:gap-3" aria-label="Primary navigation">
            <ThemeToggle />
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              href={primaryHref}
            >
              {primaryLabel}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative border-b border-slate-200/70 dark:border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(99,102,241,0.16),transparent_34%),radial-gradient(circle_at_18%_70%,rgba(14,165,233,0.10),transparent_30%)] dark:bg-[radial-gradient(circle_at_72%_18%,rgba(99,102,241,0.20),transparent_36%),radial-gradient(circle_at_18%_70%,rgba(14,165,233,0.10),transparent_34%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-10 lg:py-32">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300">
              <Sparkles aria-hidden className="h-3.5 w-3.5" />
              People operations, connected
            </div>
            <h1 className="mt-7 max-w-3xl text-5xl font-bold leading-[1.04] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl dark:text-white">
              Build better teams with a clearer hiring system.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl dark:text-slate-300">
              Bring job planning, candidate applications, structured scoring, and HR workflows into one focused workspace.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-[0_14px_30px_rgba(79,70,229,0.24)] transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                href={primaryHref}
              >
                {primaryLabel}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <a
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white/70 px-6 text-sm font-bold text-slate-700 backdrop-blur transition hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                href="#capabilities"
              >
                Explore capabilities
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              {["Secure HR access", "Structured evaluations", "Candidate-first forms"].map((item) => (
                <span className="flex items-center gap-2" key={item}>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                    <Check aria-hidden className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[580px] lg:mr-0">
            <div className="absolute -inset-10 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-600/15" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/90 bg-white/90 p-3 shadow-[0_30px_80px_rgba(30,41,59,0.16)] backdrop-blur dark:border-white/10 dark:bg-slate-900/90 dark:shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Hiring overview</p>
                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Your talent pipeline</p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white">
                    <Users aria-hidden className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    ["Open roles", "12"],
                    ["Applicants", "248"],
                    ["Interviews", "31"],
                  ].map(([label, value]) => (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" key={label}>
                      <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Candidate progress</p>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">This week</span>
                  </div>
                  <div className="mt-5 space-y-4">
                    {[
                      ["Product Designer", "18 candidates", "74%"],
                      ["HR Operations Lead", "11 candidates", "56%"],
                      ["Frontend Engineer", "24 candidates", "42%"],
                    ].map(([role, count, width]) => (
                      <div key={role}>
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{role}</span>
                          <span className="shrink-0 text-slate-400">{count}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 sm:py-28 dark:bg-slate-950/60" id="capabilities">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">A complete foundation</p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl dark:text-white">One system across the hiring lifecycle.</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Every module is designed to share the same structure, language, and source of truth.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <article className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_18px_40px_rgba(30,41,59,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/30" key={title}>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-400/10 dark:text-indigo-300">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-20 sm:py-28 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-12">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">How it works</p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl dark:text-white">From structure to shortlist.</h2>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {workflow.map((step) => (
                <article className="grid gap-4 py-8 sm:grid-cols-[72px_1fr]" key={step.number}>
                  <span className="text-sm font-bold tracking-[0.12em] text-indigo-600 dark:text-indigo-300">{step.number}</span>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{step.title}</h3>
                    <p className="mt-2 max-w-xl leading-7 text-slate-600 dark:text-slate-400">{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-20 text-white sm:px-8 sm:py-24 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/10 text-indigo-200">
            <ShieldCheck aria-hidden className="h-7 w-7" />
          </span>
          <h2 className="mt-6 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Give your hiring team a clearer way to work.</h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Access is reserved for authorized HR staff provisioned through the secure server-side seed process.</p>
          <Link className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-slate-950 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href={primaryHref}>
            {primaryLabel}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <BrandMark />
          <p className="text-sm text-slate-500 dark:text-slate-400">A focused workspace for modern people operations.</p>
        </div>
      </footer>
    </main>
  );
}
