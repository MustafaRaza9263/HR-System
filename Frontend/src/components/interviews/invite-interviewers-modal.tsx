"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Copy,
  History,
  Link2,
  Mail,
  ShieldOff,
  User,
  XCircle,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { DateTimeDisplay } from "@/components/ui/date-time-display";
import { Dropdown } from "@/components/ui/dropdown";
import { Modal } from "@/components/ui/modal";
import { StatusPills, type PillTone } from "@/components/ui/status-pills";
import { Tooltip } from "@/components/ui/tooltip";
import { UserProfile } from "@/components/ui/user-profile";
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

function requesterPills(link: DepartmentLink) {
  const items: Array<{ label: string; tone: PillTone }> = [];
  if (link.requesters.pending) items.push({ label: `${link.requesters.pending} pending`, tone: "warning" });
  if (link.requesters.approved) items.push({ label: `${link.requesters.approved} approved`, tone: "success" });
  if (link.requesters.rejected) items.push({ label: `${link.requesters.rejected} rejected`, tone: "danger" });
  if (link.requesters.revoked) items.push({ label: `${link.requesters.revoked} revoked`, tone: "neutral" });
  if (items.length === 0) items.push({ label: "No requesters yet", tone: "neutral" });
  return items;
}

function linkStatusPills(link: DepartmentLink): Array<{ label: string; tone: PillTone }> {
  return link.expired
    ? [{ label: "Expired", tone: "danger" }]
    : [{ label: "Active", tone: "success" }];
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

function statusTone(status: RegistrantStatus): PillTone {
  switch (status) {
    case "pending_approval":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "revoked":
      return "neutral";
    default:
      return "neutral";
  }
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button aria-label={label} className="icon-button" disabled={disabled} onClick={onClick} type="button">
        {children}
      </button>
    </Tooltip>
  );
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
    <Modal
      bodyClassName="flex min-h-0 flex-col"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 aria-hidden className="h-3.5 w-3.5" />
            Link expires at midnight
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User aria-hidden className="h-3.5 w-3.5" />
            Guest access: department+day
          </span>
        </div>
      }
      height="max-h-full h-[85dvh] md:h-[40rem]"
      maxWidth="max-w-5xl"
      onClose={onClose}
      padded={false}
      title={
        <span className="inline-flex items-center gap-2">
          <Link2 aria-hidden className="h-5 w-5 text-indigo-600" />
          Invite interviewer
        </span>
      }
    >
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
                    <th className="px-4 py-3">Created At</th>
                    <th className="px-4 py-3">Link</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Requesters</th>
                    <th className="px-4 py-3">Status</th>
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
    </Modal>
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
        <td className="whitespace-nowrap px-4 py-3">
          <DateTimeDisplay value={link.createdAt} />
        </td>
        <td className="max-w-[220px] px-4 py-3">
          <span className="block truncate font-mono text-xs text-gray-600 dark:text-gray-300" title={link.url}>
            {shortUrl(link.url)}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-200">
          {link.departmentName ?? "Department"}
          <span className="mt-0.5 block text-xs text-gray-400">{link.accessDate}</span>
        </td>
        <td className="px-4 py-3 align-middle">
          <StatusPills direction="row" items={requesterPills(link)} />
        </td>
        <td className="px-4 py-3 align-middle">
          <StatusPills items={linkStatusPills(link)} />
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1">
            <IconAction label={copied ? "Copied!" : "Copy"} onClick={onCopy}>
              {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
            </IconAction>
            <IconAction label={mailing ? "Cancel email" : "Mail"} onClick={onToggleMail}>
              <Mail aria-hidden className="h-4 w-4" />
            </IconAction>
            <IconAction label={expanded ? "Hide requesters" : "Expand"} onClick={onToggleExpand}>
              <ChevronDown aria-hidden className={`h-4 w-4 transition-transform duration-300 ease-in-out ${expanded ? "rotate-180" : ""}`} />
            </IconAction>
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
      <ExpandableRegistrants expanded={expanded} pendingReview={pendingReview} token={link.token} onReview={onReview} />
    </>
  );
}

function ExpandableRegistrants({
  expanded,
  token,
  pendingReview,
  onReview,
}: {
  expanded: boolean;
  token: string;
  pendingReview: boolean;
  onReview: (id: string, action: "approve" | "reject" | "revoke") => void;
}) {
  const [mounted, setMounted] = useState(expanded);
  const [shown, setShown] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setMounted(true);
      let cancelled = false;
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!cancelled) setShown(true);
        });
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(frame);
      };
    }

    setShown(false);
    const timeout = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(timeout);
  }, [expanded]);

  if (!mounted) return null;

  return (
    <tr>
      <td className="p-0" colSpan={6}>
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
            shown ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div
              className={`bg-gray-50 px-4 py-3 transition-opacity duration-300 ease-in-out motion-reduce:transition-none dark:bg-gray-900/60 ${
                shown ? "opacity-100" : "opacity-0"
              }`}
            >
              <RegistrantList pendingReview={pendingReview} token={token} onReview={onReview} />
            </div>
          </div>
        </div>
      </td>
    </tr>
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
          <UserProfile className="min-w-0 flex-1" email={item.email} name={item.name} />
          <StatusPills items={[{ label: statusLabel(item.status), tone: statusTone(item.status) }]} />
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
      <div className="flex items-center gap-1">
        <IconAction disabled={busy} label="Approve" onClick={() => onReview(registrant.id, "approve")}>
          <CircleCheck aria-hidden className="h-4 w-4" />
        </IconAction>
        <IconAction disabled={busy} label="Reject" onClick={() => onReview(registrant.id, "reject")}>
          <XCircle aria-hidden className="h-4 w-4" />
        </IconAction>
      </div>
    );
  }
  if (registrant.status === "approved") {
    return (
      <IconAction disabled={busy} label="Revoke" onClick={() => onReview(registrant.id, "revoke")}>
        <ShieldOff aria-hidden className="h-4 w-4" />
      </IconAction>
    );
  }
  return null;
}
