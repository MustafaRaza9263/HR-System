"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  History,
  Link2,
  Mail,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Dropdown } from "@/components/ui/dropdown";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import type {
  DepartmentLink,
  DepartmentLinkResponse,
  DepartmentLinksListResponse,
  LinkRegistrant,
  LinkRegistrantsResponse,
  RegistrantStatus,
} from "@/lib/interviews/types";
import { queryKeys } from "@/lib/query/query-keys";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

function shortUrl(url: string) {
  if (url.length <= 36) return url;
  return `${url.slice(0, 24)}…${url.slice(-8)}`;
}

function requesterSummary(link: DepartmentLink) {
  const parts: string[] = [];
  if (link.requesters.pending) parts.push(`${link.requesters.pending} pending`);
  if (link.requesters.approved) parts.push(`${link.requesters.approved} approved`);
  if (link.requesters.rejected) parts.push(`${link.requesters.rejected} rejected`);
  if (link.requesters.revoked) parts.push(`${link.requesters.revoked} revoked`);
  return parts.length > 0 ? parts.join(" · ") : "No requesters yet";
}

function statusLabel(status: RegistrantStatus) {
  switch (status) {
    case "pending_approval":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Revoked";
  }
}

function statusBadge(status: RegistrantStatus) {
  switch (status) {
    case "pending_approval":
      return "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300";
    case "approved":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "rejected":
      return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300";
    default:
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  }
}

interface DepartmentOption {
  id: string;
  name: string;
  status: string;
}

export function InviteInterviewersModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [mailToken, setMailToken] = useState<string | null>(null);
  const [mailEmail, setMailEmail] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const departmentsQuery = useQuery({
    queryKey: queryKeys.departments.list,
    queryFn: async () => apiRequest<{ data: { departments: DepartmentOption[] } }>("/departments"),
  });

  const linksQuery = useQuery({
    queryKey: queryKeys.interviews.departmentLinks(),
    queryFn: async () => apiRequest<DepartmentLinksListResponse>("/department-links"),
  });

  const departments = (departmentsQuery.data?.data.departments ?? []).filter((item) => item.status === "active");
  const links = linksQuery.data?.data.links ?? [];
  const hasEmail = inviteEmail.trim().length > 0;

  function invalidateLinks() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.interviews.departmentLinksAll });
    void queryClient.invalidateQueries({ queryKey: queryKeys.interviews.pendingLinks });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  }

  async function copyUrl(link: DepartmentLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedToken(link.token);
      window.setTimeout(() => setCopiedToken((current) => (current === link.token ? null : current)), 1500);
    } catch {
      alerts.error("Could not copy the link.");
    }
  }

  const createMutation = useMutation({
    mutationFn: async () =>
      apiRequest<DepartmentLinkResponse>("/department-links", {
        method: "POST",
        body: JSON.stringify({
          departmentId,
          ...(hasEmail ? { email: inviteEmail.trim() } : {}),
        }),
      }),
    onSuccess: (result) => {
      alerts.success(hasEmail ? "Link generated and emailed." : "Access link is ready.");
      invalidateLinks();
      void copyUrl(result.data.link);
    },
    onError: (error) => alerts.error(errorMessage(error, "Access link could not be created.")),
  });

  const mailMutation = useMutation({
    mutationFn: async ({ token, email }: { token: string; email: string }) =>
      apiRequest(`/department-links/${token}/send-email`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => {
      alerts.success("Link emailed.");
      setMailToken(null);
      setMailEmail("");
    },
    onError: (error) => alerts.error(errorMessage(error, "Email could not be sent.")),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" | "revoke" }) =>
      apiRequest(`/link-registrants/${id}/${action}`, { method: "PATCH" }),
    onSuccess: (_result, variables) => {
      const labels = {
        approve: "Access approved. They were emailed the link.",
        reject: "Request rejected.",
        revoke: "Access revoked. They can no longer use this browser session.",
      };
      alerts.success(labels[variables.action]);
      invalidateLinks();
      if (expandedToken) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.interviews.linkRegistrants(expandedToken) });
      }
    },
    onError: (error) => alerts.error(errorMessage(error, "Request could not be updated.")),
  });

  return (
    <div
      className="fixed inset-0 z-[1100] grid place-items-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-labelledby="invite-interviewer-title"
        aria-modal="true"
        className="flex h-[40rem] max-h-[calc(100svh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-5 sm:px-6 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Link2 aria-hidden className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-950 dark:text-white" id="invite-interviewer-title">
              Invite interviewer
            </h2>
          </div>
          <button aria-label="Close modal" className="icon-button" onClick={onClose} type="button">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </header>

        <div className="shrink-0 px-5 pt-4 sm:px-6">
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/70">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="min-w-0 flex-1">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                  <Building2 aria-hidden className="h-4 w-4 text-gray-400" />
                  Department
                </span>
                <Dropdown
                  aria-label="Select department"
                  className="w-full"
                  onChange={setDepartmentId}
                  options={[
                    { value: "", label: "Select a department" },
                    ...departments.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                  size="md"
                  value={departmentId}
                />
              </label>
              <label className="min-w-0 flex-1">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                  <Mail aria-hidden className="h-4 w-4 text-gray-400" />
                  Email <span className="font-medium text-gray-400">(optional)</span>
                </span>
                <input
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="Send the link now"
                  type="email"
                  value={inviteEmail}
                />
              </label>
              <button
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!departmentId || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                type="button"
              >
                {createMutation.isPending ? "Generating…" : hasEmail ? "Generate & Send" : "Generate"}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <section className="flex min-h-0 flex-1 flex-col px-5 pb-2 pt-4 sm:px-6">
          <h3 className="flex shrink-0 items-center gap-2 text-sm font-bold text-gray-950 dark:text-white">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
              <History aria-hidden className="h-3.5 w-3.5" />
            </span>
            Previous invitations
          </h3>
          <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
            {linksQuery.isPending ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((item) => (
                  <div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" key={item} />
                ))}
              </div>
            ) : null}
            {linksQuery.isError ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                {errorMessage(linksQuery.error, "Invitations could not be loaded.")}
                <button
                  className="mt-2 block w-full text-sm font-bold text-indigo-600"
                  onClick={() => void linksQuery.refetch()}
                  type="button"
                >
                  Try again
                </button>
              </div>
            ) : null}
            {linksQuery.isSuccess && links.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-gray-500">No invitations yet. Generate a department link to get started.</p>
            ) : null}
            {linksQuery.isSuccess && links.length > 0 ? (
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Link</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Requesters</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {links.map((link) => {
                    const expanded = expandedToken === link.token;
                    return (
                      <LinkRow
                        copied={copiedToken === link.token}
                        expanded={expanded}
                        key={link.token}
                        link={link}
                        mailEmail={mailToken === link.token ? mailEmail : ""}
                        mailing={mailToken === link.token}
                        pendingReview={reviewMutation.isPending}
                        sendingMail={mailMutation.isPending && mailMutation.variables?.token === link.token}
                        onCopy={() => void copyUrl(link)}
                        onMailEmailChange={setMailEmail}
                        onReview={(id, action) => reviewMutation.mutate({ id, action })}
                        onSendMail={() => {
                          const email = mailEmail.trim();
                          if (!email) {
                            alerts.error("Enter an email.");
                            return;
                          }
                          mailMutation.mutate({ token: link.token, email });
                        }}
                        onToggleExpand={() => setExpandedToken(expanded ? null : link.token)}
                        onToggleMail={() => {
                          setMailToken((current) => (current === link.token ? null : link.token));
                          setMailEmail("");
                        }}
                      />
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </div>
        </section>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-500 sm:px-6 dark:border-gray-700 dark:bg-gray-800/70">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 aria-hidden className="h-3.5 w-3.5" />
            Link expires at midnight
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User aria-hidden className="h-3.5 w-3.5" />
            Guest access: department+day
          </span>
        </footer>
      </div>
    </div>
  );
}

function LinkRow({
  link,
  expanded,
  copied,
  mailing,
  mailEmail,
  sendingMail,
  pendingReview,
  onCopy,
  onToggleExpand,
  onToggleMail,
  onMailEmailChange,
  onSendMail,
  onReview,
}: {
  link: DepartmentLink;
  expanded: boolean;
  copied: boolean;
  mailing: boolean;
  mailEmail: string;
  sendingMail: boolean;
  pendingReview: boolean;
  onCopy: () => void;
  onToggleExpand: () => void;
  onToggleMail: () => void;
  onMailEmailChange: (value: string) => void;
  onSendMail: () => void;
  onReview: (id: string, action: "approve" | "reject" | "revoke") => void;
}) {
  return (
    <>
      <tr className="align-middle">
        <td className="max-w-[220px] px-4 py-3">
          <span className="block truncate font-mono text-xs text-gray-600 dark:text-gray-300" title={link.url}>
            {shortUrl(link.url)}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-200">
          {link.departmentName ?? "Department"}
          <span className="mt-0.5 block text-xs text-gray-400">{link.accessDate}</span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{requesterSummary(link)}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400"
              onClick={onCopy}
              type="button"
            >
              {copied ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 dark:text-gray-200" onClick={onToggleMail} type="button">
              <Mail aria-hidden className="h-3.5 w-3.5" />
              Mail
            </button>
            <button
              className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 dark:text-gray-200"
              onClick={onToggleExpand}
              type="button"
            >
              <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Hide" : "Expand"}
            </button>
          </div>
          {mailing ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onSendMail();
              }}
            >
              <input
                autoFocus
                className="h-8 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                onChange={(event) => onMailEmailChange(event.target.value)}
                placeholder="email@example.com"
                type="email"
                value={mailEmail}
              />
              <button className="h-8 rounded-lg bg-indigo-600 px-2 text-xs font-bold text-white disabled:opacity-50" disabled={sendingMail} type="submit">
                {sendingMail ? "Sending…" : "Send"}
              </button>
            </form>
          ) : null}
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td className="bg-gray-50 px-4 py-3 dark:bg-gray-900/60" colSpan={4}>
            <RegistrantList pendingReview={pendingReview} token={link.token} onReview={onReview} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function RegistrantList({
  token,
  pendingReview,
  onReview,
}: {
  token: string;
  pendingReview: boolean;
  onReview: (id: string, action: "approve" | "reject" | "revoke") => void;
}) {
  const query = useQuery({
    queryKey: queryKeys.interviews.linkRegistrants(token),
    queryFn: async () => apiRequest<LinkRegistrantsResponse>(`/department-links/${token}/registrants`),
  });

  if (query.isPending) {
    return <p className="text-xs text-gray-400">Loading requesters…</p>;
  }
  if (query.isError) {
    return <p className="text-xs text-red-500">{errorMessage(query.error, "Requesters could not be loaded.")}</p>;
  }

  const registrants = query.data?.data.registrants ?? [];
  if (registrants.length === 0) {
    return <p className="text-xs text-gray-400">No one has requested access on this link yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {registrants.map((item) => (
        <li className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800" key={item.id}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
            <p className="truncate text-xs text-gray-500">{item.email}</p>
          </div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadge(item.status)}`}>
            {statusLabel(item.status)}
          </span>
          <RegistrantActions busy={pendingReview} registrant={item} onReview={onReview} />
        </li>
      ))}
    </ul>
  );
}

function RegistrantActions({
  registrant,
  busy,
  onReview,
}: {
  registrant: LinkRegistrant;
  busy: boolean;
  onReview: (id: string, action: "approve" | "reject" | "revoke") => void;
}) {
  if (registrant.status === "pending_approval") {
    return (
      <div className="flex items-center gap-3">
        <button className="text-xs font-bold text-emerald-600 disabled:opacity-50" disabled={busy} onClick={() => onReview(registrant.id, "approve")} type="button">
          ✓ Approve
        </button>
        <button className="text-xs font-bold text-red-600 disabled:opacity-50" disabled={busy} onClick={() => onReview(registrant.id, "reject")} type="button">
          ✕ Reject
        </button>
      </div>
    );
  }
  if (registrant.status === "approved") {
    return (
      <button className="text-xs font-bold text-red-600 disabled:opacity-50" disabled={busy} onClick={() => onReview(registrant.id, "revoke")} type="button">
        Revoke
      </button>
    );
  }
  return <span className="text-xs text-gray-400">View only</span>;
}
