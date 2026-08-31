"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Minus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Dropdown } from "@/components/ui/dropdown";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query/query-keys";

export interface PublicJob {
  id: string;
  slug: string | null;
  title: string;
  departmentId: string;
  departmentName: string;
  jobType: string | null;
  positionsAvailable: number;
  publishedAt: string | null;
}

interface CareersResponse {
  data: {
    jobs: PublicJob[];
    teams: Array<{ id: string; name: string }>;
  };
}

export function CareersBoard() {
  const [teamId, setTeamId] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const careersQuery = useQuery({
    queryKey: queryKeys.careers.openJobs,
    queryFn: async () => apiRequest<CareersResponse>("/careers/jobs"),
  });

  const jobs = careersQuery.data?.data.jobs ?? [];
  const teams = careersQuery.data?.data.teams ?? [];

  const filteredJobs = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase();
    return jobs.filter((job) => {
      if (teamId && job.departmentId !== teamId) return false;
      if (!clean) return true;
      return (
        job.title.toLocaleLowerCase().includes(clean) ||
        job.departmentName.toLocaleLowerCase().includes(clean) ||
        (job.jobType?.toLocaleLowerCase().includes(clean) ?? false)
      );
    });
  }, [jobs, teamId, query]);

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; jobs: PublicJob[] }>();
    for (const job of filteredJobs) {
      const current = map.get(job.departmentId);
      if (current) {
        current.jobs.push(job);
      } else {
        map.set(job.departmentId, {
          id: job.departmentId,
          name: job.departmentName,
          jobs: [job],
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredJobs]);

  function toggleTeam(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="min-h-svh bg-[#f7f7f5] text-neutral-900 dark:bg-gray-950 dark:text-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h1 className="text-4xl font-bold tracking-[-0.04em] text-neutral-950 sm:text-5xl dark:text-white">
            Join our team
          </h1>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Dropdown
              aria-label="Filter by team"
              className="w-full min-w-[10.5rem] sm:w-[12.5rem]"
              onChange={setTeamId}
              options={[
                { value: "", label: "All Teams" },
                ...teams.map((team) => ({ value: team.id, label: team.name })),
              ]}
              value={teamId}
            />
            <label className="relative min-w-0 sm:min-w-[16rem]">
              <span className="sr-only">Search roles</span>
              <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                className="h-11 w-full rounded-xl border border-neutral-300 bg-white py-2 pl-10 pr-4 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search roles"
                value={query}
              />
            </label>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-200 dark:border-gray-800">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto] gap-6 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 sm:grid">
            <span>Team</span>
            <span>Role</span>
            <span className="text-right">Apply</span>
          </div>

          {careersQuery.isPending ? (
            <div className="space-y-0 border-t border-neutral-200 dark:border-gray-800" aria-label="Loading open roles" role="status">
              {[1, 2, 3, 4].map((item) => (
                <div className="h-16 animate-pulse border-b border-neutral-200 bg-neutral-200/40 dark:border-gray-800 dark:bg-gray-900" key={item} />
              ))}
            </div>
          ) : null}

          {careersQuery.isError ? (
            <div className="border-t border-neutral-200 py-16 text-center dark:border-gray-800">
              <p className="text-sm font-semibold text-neutral-800 dark:text-white">Open roles could not be loaded.</p>
              <button
                className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400"
                onClick={() => void careersQuery.refetch()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : null}

          {careersQuery.isSuccess && groups.length === 0 ? (
            <div className="border-t border-neutral-200 py-16 text-center dark:border-gray-800">
              <p className="text-sm font-semibold text-neutral-800 dark:text-white">
                {jobs.length === 0 ? "No open roles right now" : "No roles match your filters"}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {jobs.length === 0 ? "Check back soon for new opportunities." : "Try another team or search term."}
              </p>
            </div>
          ) : null}

          {careersQuery.isSuccess
            ? groups.map((group) => {
                const isOpen = expanded.has(group.id) || Boolean(query.trim());
                const countLabel = `${group.jobs.length} Open Role${group.jobs.length === 1 ? "" : "s"}`;
                return (
                  <section className="border-t border-neutral-200 dark:border-gray-800" key={group.id}>
                    <button
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-4 py-5 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      onClick={() => toggleTeam(group.id)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1 text-base font-bold tracking-[-0.02em] text-neutral-950 sm:text-lg dark:text-white">
                        {group.name}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                        {countLabel}
                        {isOpen ? <Minus aria-hidden className="h-4 w-4" /> : <Plus aria-hidden className="h-4 w-4" />}
                      </span>
                    </button>

                    {isOpen ? (
                      <ul className="pb-1">
                        {group.jobs.map((job) => (
                          <li
                            className="grid grid-cols-1 items-center gap-3 border-t border-neutral-100 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto] sm:gap-6 dark:border-gray-900"
                            key={job.id}
                          >
                            <span className="text-sm font-medium text-neutral-900 sm:col-start-2 dark:text-white">{job.title}</span>
                            <div className="sm:col-start-3 sm:justify-self-end">
                              {job.slug ? (
                                <Link
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                                  href={`/apply/${job.slug}`}
                                >
                                  Apply
                                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                                </Link>
                              ) : (
                                <span className="inline-flex h-9 items-center rounded-lg border border-dashed border-neutral-300 px-3.5 text-sm text-neutral-400">
                                  Unavailable
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                );
              })
            : null}
        </div>
      </div>
    </main>
  );
}
