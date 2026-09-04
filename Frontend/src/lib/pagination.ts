export const LIST_PAGE_LIMIT = 15;

export interface ListPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export function emptyPagination(page = 1, limit = LIST_PAGE_LIMIT): ListPagination {
  return { total: 0, page, limit, pages: 1 };
}

export function listQueryString(filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}
