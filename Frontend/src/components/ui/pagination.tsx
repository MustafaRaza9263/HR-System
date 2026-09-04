"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { ListPagination } from "@/lib/pagination";

type PaginationItem = number | "ellipsis";

function pageItems(currentPage: number, totalPages: number, siblingCount = 1): PaginationItem[] {
  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);
  const items: PaginationItem[] = [1];

  if (leftSibling > 2) items.push("ellipsis");

  const rangeStart = leftSibling === 1 ? 2 : leftSibling;
  const rangeEnd = rightSibling === totalPages ? totalPages - 1 : rightSibling;
  for (let page = rangeStart; page <= rangeEnd; page += 1) items.push(page);

  if (rightSibling < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

interface PaginationBarProps {
  pagination: ListPagination;
  onPageChange: (page: number) => void;
}

export function PaginationBar({ pagination, onPageChange }: PaginationBarProps) {
  if (pagination.total <= 0) return null;

  const currentPage = Math.min(pagination.page, pagination.pages);
  const rangeStart = (currentPage - 1) * pagination.limit + 1;
  const rangeEnd = Math.min(currentPage * pagination.limit, pagination.total);
  const items = pageItems(currentPage, pagination.pages);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-gray-700 dark:bg-gray-800/70"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing{" "}
        <span className="font-semibold text-gray-800 dark:text-white">
          {rangeStart}-{rangeEnd}
        </span>{" "}
        of <span className="font-semibold text-gray-800 dark:text-white">{pagination.total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          aria-label="Previous page"
          className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
        {items.map((item, index) =>
          item === "ellipsis" ? (
            <span
              className="grid h-9 w-9 place-items-center text-sm text-gray-400 select-none dark:text-gray-500"
              key={`ellipsis-${index}`}
            >
              …
            </span>
          ) : (
            <button
              aria-current={item === currentPage ? "page" : undefined}
              aria-label={`Page ${item}`}
              className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-semibold transition ${
                item === currentPage
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
              }`}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item}
            </button>
          ),
        )}
        <button
          aria-label="Next page"
          className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          disabled={currentPage >= pagination.pages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
