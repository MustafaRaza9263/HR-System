"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { z } from "zod";

import { AlertBridge } from "@/components/alerts/alert-bridge";
import { apiRequest, ApiClientError } from "@/lib/api";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must contain at least 2 characters.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string()
    .min(12, "Password must contain at least 12 characters.")
    .max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number.")
    .regex(/[^A-Za-z0-9]/, "Include a special character."),
});

type FieldErrors = Partial<Record<"name" | "email" | "password", string[]>>;

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<{ message?: string; eventKey?: string }>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      setFields(parsed.error.flatten().fieldErrors);
      setError({ eventKey: crypto.randomUUID() });
      return;
    }

    setPending(true);
    setFields({});
    setError({});
    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        setFields((requestError.fields as FieldErrors | undefined) ?? {});
        setError({ message: requestError.message, eventKey: crypto.randomUUID() });
      } else {
        setError({
          message: "We could not create your account. Please try again.",
          eventKey: crypto.randomUUID(),
        });
      }
    } finally {
      setPending(false);
    }
  }

  const fieldMessage = [fields.name?.[0], fields.email?.[0], ...(fields.password ?? [])]
    .filter(Boolean)
    .join(" ");
  const inputClassName = "h-13 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/15";

  return (
    <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
      <AlertBridge dedupeKey="register-error" eventKey={error.eventKey} message={error.message} title="Registration failed" />
      <AlertBridge dedupeKey="register-validation" eventKey={error.eventKey} message={fieldMessage} title="Check your details" tone="warning" />

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="name">Full name</label>
        <div className="relative">
          <UserRound aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input aria-invalid={Boolean(fields.name)} autoComplete="name" autoFocus className={inputClassName} id="name" name="name" placeholder="Alex Morgan" type="text" />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="email">Work email</label>
        <div className="relative">
          <Mail aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input aria-invalid={Boolean(fields.email)} autoComplete="email" className={inputClassName} id="email" name="email" placeholder="you@company.com" type="email" />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="password">Password</label>
        <div className="relative">
          <LockKeyhole aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input aria-invalid={Boolean(fields.password)} autoComplete="new-password" className={`${inputClassName} pr-12`} id="password" name="password" placeholder="At least 12 characters" type={showPassword ? "text" : "password"} />
          <button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200" onClick={() => setShowPassword((visible) => !visible)} type="button">
            {showPassword ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">Use uppercase, lowercase, a number, and a special character.</p>
      </div>

      <button className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-65" disabled={pending} type="submit">
        {pending ? <LoaderCircle aria-hidden className="h-5 w-5 animate-spin" /> : null}
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
