import { z } from "zod";

export const LIST_PAGE_LIMIT = 15;
export const MAX_PAGE_LIMIT = 50;

export const listPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional().default(LIST_PAGE_LIMIT),
});

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit) || 1),
  };
}
