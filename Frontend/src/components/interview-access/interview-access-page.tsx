"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";

import { alerts } from "@/lib/alerts";
import { ApiClientError, apiDownload, apiRequest } from "@/lib/api";
import { formatInterviewWhen } from "@/lib/interviews/format";
import type { AccessInterviewsResponse, AccessLinkResponse } from "@/lib/interviews/types";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function InterviewAccessPage({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState<string | null>(null);

  const stateQuery = useQuery({
    queryKey: ["interview-access", token],
    queryFn: async () => apiRequest<AccessLinkResponse>(`/interview-access/${token}`),
    refetchInterval: (query) => {
      const status = query.state.data?.data.state.session?.status;
      if (status === "pending_approval") return 4000;
      if (status === "approved" && !query.state.data?.data.expired) return 5000;
      return false;
    },
  });

  const sessionStatus = stateQuery.data?.data.state.session?.status;
  const interviewsQuery = useQuery({
    queryKey: ["interview-access", token, "interviews"],
    enabled: sessionStatus === "approved" && !stateQuery.data?.data.expired,
    queryFn: async () => apiRequest<AccessInterviewsResponse>(`/interview-access/${token}/interviews`),
    refetchInterval: 5000,
    retry: (count, error) => {
      if (error instanceof ApiClientError && (error.code === "LINK_REVOKED" || error.code === "LINK_EXPIRED" || error.code === "LINK_NOT_APPROVED")) {
        return false;
      }
      return count < 2;
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () =>
      apiRequest<AccessLinkResponse>(`/interview-access/${token}/register`, {
        method: "POST",
        body: JSON.stringify({ name, email }),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["interview-access", token], result);
    },
    onError: (error) => alerts.error(errorMessage(error, "Request could not be submitted.")),
  });

  const noteMutation = useMutation({
    mutationFn: async ({ interviewId, content }: { interviewId: string; content: string }) =>
      apiRequest(`/interview-access/${token}/interviews/${interviewId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: (_result, variables) => {
      setNoteDrafts((current) => ({ ...current, [variables.interviewId]: "" }));
      alerts.success("Note added.");
      void queryClient.invalidateQueries({ queryKey: ["interview-access", token, "interviews"] });
    },
    onError: (error) => {
      alerts.error(errorMessage(error, "Note could not be saved."));
      if (error instanceof ApiClientError && (error.code === "LINK_REVOKED" || error.code === "LINK_EXPIRED")) {
        void queryClient.invalidateQueries({ queryKey: ["interview-access", token] });
      }
    },
  });

  async function downloadResume(path: string, filename: string, key: string) {
    setDownloading(key);
    try {
      await apiDownload(path, filename);
    } catch (error) {
      alerts.error(errorMessage(error, "Resume could not be downloaded."));
    } finally {
      setDownloading(null);
    }
  }

  const payload = stateQuery.data?.data;
  const shell = "mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900";

  if (stateQuery.isPending) {
    return <div className="mx-auto h-40 max-w-3xl animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />;
  }
  if (stateQuery.isError) {
    return (
      <div className={shell}>
        <h1 className="text-lg font-bold">Access link unavailable</h1>
        <p className="mt-2 text-sm text-gray-500">{errorMessage(stateQuery.error, "This link is invalid.")}</p>
      </div>
    );
  }
  if (!payload) return null;

  const interviewsErrorCode = interviewsQuery.error instanceof ApiClientError ? interviewsQuery.error.code : "";
  const session = payload.state.session;

  if (payload.expired || interviewsErrorCode === "LINK_EXPIRED") {
    return (
      <div className={shell}>
        <h1 className="text-lg font-bold">This link has expired</h1>
        <p className="mt-2 text-sm text-gray-500">Ask HR to generate a new access link for today.</p>
      </div>
    );
  }

  if (session?.status === "revoked" || interviewsErrorCode === "LINK_REVOKED") {
    return (
      <div className={shell}>
        <h1 className="text-lg font-bold">Access was revoked</h1>
        <p className="mt-2 text-sm text-gray-500">HR revoked your access. Ask them to approve you again if you still need it.</p>
      </div>
    );
  }

  if (session?.status === "rejected") {
    return (
      <div className={shell}>
        <h1 className="text-lg font-bold">Request not approved</h1>
        <p className="mt-2 text-sm text-gray-500">
          HR did not approve this access request. You can submit a new request from this browser if they send you the link again.
        </p>
      </div>
    );
  }

  if (session?.status === "pending_approval") {
    return (
      <div className={shell}>
        <h1 className="text-lg font-bold">Waiting for HR approval</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your request{session.name ? ` as ${session.name}` : ""} is awaiting HR approval. This page updates automatically.
        </p>
      </div>
    );
  }

  if (session?.status !== "approved") {
    return (
      <form
        className={shell}
        onSubmit={(event) => {
          event.preventDefault();
          registerMutation.mutate();
        }}
      >
        <h1 className="text-lg font-bold">Request interview access</h1>
        <p className="mt-1 text-sm text-gray-500">
          {payload.state.departmentName ? `${payload.state.departmentName} · ` : ""}
          Submit your name and email. HR must approve before you can add notes.
        </p>
        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-bold">Name</span>
          <input
            className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-bold">Email</span>
          <input
            className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <button
          className="mt-5 h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white disabled:opacity-50"
          disabled={registerMutation.isPending}
          type="submit"
        >
          {registerMutation.isPending ? "Submitting…" : "Request access"}
        </button>
      </form>
    );
  }

  const interviews = interviewsQuery.data?.data.interviews ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className={shell}>
        <h1 className="text-lg font-bold">Today’s interviews</h1>
        <p className="mt-1 text-sm text-gray-500">
          {payload.state.departmentName ?? "Department"} · signed in as {interviewsQuery.data?.data.registrant.name ?? session.name}
        </p>
      </div>
      {interviewsQuery.isPending ? <div className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" /> : null}
      {interviewsQuery.isSuccess && interviews.length === 0 ? (
        <div className={shell}>
          <p className="text-sm text-gray-500">No scheduled interviews for this department today.</p>
        </div>
      ) : null}
      {interviews.map((interview) => (
        <article className={shell} key={interview.id}>
          <p className="text-base font-bold">{interview.candidateName}</p>
          <p className="text-sm text-gray-500">{interview.candidateEmail}</p>
          <p className="mt-2 text-sm">
            {interview.jobTitle} · {formatInterviewWhen(interview.date, interview.time)} · {interview.durationMinutes} min
          </p>
          <button
            className="mt-3 h-9 rounded-lg border border-gray-300 px-3 text-xs font-bold disabled:opacity-50 dark:border-gray-600"
            disabled={downloading === interview.id}
            onClick={() =>
              void downloadResume(interview.resumePath, interview.resumeOriginalName, interview.id)
            }
            type="button"
          >
            {downloading === interview.id ? "Downloading…" : "Download CV"}
          </button>
          <div className="mt-4 space-y-2">
            {interview.notes.map((note) => (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800" key={note.id}>
                <p className="font-semibold">
                  {note.authorName} · {format(new Date(note.createdAt), "d MMM, HH:mm")}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const content = (noteDrafts[interview.id] ?? "").trim();
                if (!content) return;
                noteMutation.mutate({ interviewId: interview.id, content });
              }}
            >
              <textarea
                className="min-h-20 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                onChange={(event) => setNoteDrafts((current) => ({ ...current, [interview.id]: event.target.value }))}
                placeholder="Add a note…"
                value={noteDrafts[interview.id] ?? ""}
              />
              <button className="h-10 self-end rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white" disabled={noteMutation.isPending} type="submit">
                Add
              </button>
            </form>
          </div>
        </article>
      ))}
    </div>
  );
}
