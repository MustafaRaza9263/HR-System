"use client";

import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { useState } from "react";

import { DateTimeDisplay } from "@/components/ui/date-time-display";
import { StatusPills, type PillTone } from "@/components/ui/status-pills";
import { getInitials } from "@/components/ui/user-profile";
import type { AccessSession, RegistrantStatus } from "@/lib/interviews/types";

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
    default:
      return "neutral";
  }
}

export function InterviewAccessHeader({
  session,
  expiresAt,
}: {
  session: AccessSession | null;
  expiresAt?: string;
}) {
  return (
    <header className="relative z-20 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-3 items-center gap-3 px-4 md:px-6">
        <div className="min-w-0 justify-self-start">
          <p className="truncate text-[15px] font-bold tracking-tight text-indigo-600 dark:text-indigo-400">HR System</p>
        </div>
        <h1 className="justify-self-center truncate text-center text-sm font-bold text-gray-950 md:text-base dark:text-white">
          Interviewer Portal
        </h1>
        <div className="justify-self-end">
          {session ? <ProfileMenu expiresAt={expiresAt} session={session} /> : null}
        </div>
      </div>
    </header>
  );
}

function ProfileMenu({ session, expiresAt }: { session: AccessSession; expiresAt?: string }) {
  const [open, setOpen] = useState(false);
  const [referenceEl, setReferenceEl] = useState<HTMLElement | null>(null);
  const [floatingEl, setFloatingEl] = useState<HTMLElement | null>(null);
  const { floatingStyles, context } = useFloating({
    elements: { floating: floatingEl, reference: referenceEl },
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open profile"
        className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 outline-none ring-offset-2 hover:bg-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-[#2a2150] dark:text-indigo-300 dark:hover:bg-[#352868]"
        type="button"
        {...getReferenceProps({
          onClick() {
            setOpen((current) => !current);
          },
        })}
        ref={setReferenceEl}
      >
        {getInitials(session.name)}
      </button>
      {open ? (
        <FloatingPortal>
          <div
            className="z-[1200] w-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.14)] dark:border-gray-700 dark:bg-gray-900 dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
            role="dialog"
            style={floatingStyles}
            {...getFloatingProps()}
            ref={setFloatingEl}
          >
            <p className="truncate text-sm font-bold text-gray-950 dark:text-white">{session.name}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{session.email}</p>
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Status</p>
              <div className="mt-1.5">
                <StatusPills items={[{ label: statusLabel(session.status), tone: statusTone(session.status) }]} />
              </div>
            </div>
            {expiresAt ? (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Expires at</p>
                <div className="mt-1.5">
                  <DateTimeDisplay value={expiresAt} />
                </div>
              </div>
            ) : null}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
