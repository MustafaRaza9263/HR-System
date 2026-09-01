"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { z } from "zod";

import { AlertBridge } from "@/components/alerts/alert-bridge";
import { apiRequest, ApiClientError } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

interface LoginState {
  message?: string;
  fields?: { email?: string[]; password?: string[] };
  eventKey?: string;
}

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<LoginState>({});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fieldErrorMessage = [
    state.fields?.email?.[0],
    state.fields?.password?.[0],
  ]
    .filter(Boolean)
    .join(" ");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      setState({
        eventKey: crypto.randomUUID(),
        fields: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    setPending(true);
    setState({});
    try {
      await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      void import("@/lib/notifications/fcm").then(({ registerHrPush }) => registerHrPush()).catch(() => undefined);
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "We could not sign you in. Please try again.";
      setState({ eventKey: crypto.randomUUID(), message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
      <AlertBridge
        dedupeKey="login-error"
        eventKey={state.eventKey}
        message={state.message}
        title="Sign in failed"
      />
      <AlertBridge
        dedupeKey="login-field-validation"
        eventKey={state.eventKey}
        message={fieldErrorMessage}
        title="Check your details"
        tone="warning"
      />

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="email">
          Email address
        </label>
        <div className="relative">
          <Mail aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input
            aria-invalid={Boolean(state.fields?.email)}
            autoComplete="email"
            autoFocus
            className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/15"
            id="email"
            name="email"
            placeholder="you@company.com"
            type="email"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <LockKeyhole aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input
            aria-invalid={Boolean(state.fields?.password)}
            autoComplete="current-password"
            className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/15"
            id="password"
            name="password"
            placeholder="Enter your password"
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? <EyeOff aria-hidden className="h-5 w-5" strokeWidth={1.8} /> : <Eye aria-hidden className="h-5 w-5" strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      <button
        className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        {pending ? <LoaderCircle aria-hidden className="h-5 w-5 animate-spin" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
