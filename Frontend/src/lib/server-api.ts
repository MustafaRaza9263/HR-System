import { cookies } from "next/headers";

import type { AuthenticatedUser } from "@/lib/api";

const SESSION_COOKIE_NAME = "hr_session";

interface CurrentUserResponse {
  data: { user: AuthenticatedUser };
}

function getInternalApiUrl(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api/v1"
  ).replace(/\/$/, "");
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) return null;

  try {
    const response = await fetch(`${getInternalApiUrl()}/auth/me`, {
      cache: "no-store",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionCookie.value}` },
    });

    if (!response.ok) return null;
    const body = (await response.json()) as CurrentUserResponse;
    return body.data.user;
  } catch {
    return null;
  }
}
