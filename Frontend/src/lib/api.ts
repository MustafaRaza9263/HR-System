export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: "hr";
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function getPublicApiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
}

export function getApiBaseUrl() {
  return getPublicApiUrl();
}

async function throwIfFailed(response: Response) {
  if (response.ok) return;
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  throw new ApiClientError(
    response.status,
    body.error?.code ?? "REQUEST_FAILED",
    body.error?.message ?? "The request could not be completed.",
    body.error?.fields,
  );
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getPublicApiUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  await throwIfFailed(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiFormRequest<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getPublicApiUrl()}${path}`, {
    method: "POST",
    ...init,
    credentials: "include",
    body: formData,
  });

  await throwIfFailed(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface ApiBlob {
  blob: Blob;
  filename: string;
  contentType: string;
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return encoded[1];
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

export async function apiBlob(path: string): Promise<ApiBlob> {
  const response = await fetch(`${getPublicApiUrl()}${path}`, {
    credentials: "include",
  });
  await throwIfFailed(response);
  const raw = await response.blob();
  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || raw.type || "application/octet-stream";
  const blob = raw.type === contentType ? raw : new Blob([raw], { type: contentType });
  return {
    blob,
    contentType,
    filename: filenameFromDisposition(response.headers.get("content-disposition")) ?? "resume",
  };
}

export async function apiDownload(path: string, filename: string) {
  const { blob } = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
