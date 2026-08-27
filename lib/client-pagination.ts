import * as React from "react";

/** Team Members directory: 3 columns × 2 rows per page. */
export const GRID_DIRECTORY_PAGE_SIZE = 6;

export function getPaginationRange(
  page: number,
  pageSize: number,
  totalItems: number,
): { start: number; end: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  return { start, end, totalPages };
}

export function useClientPagination<T>(
  items: T[],
  pageSize: number,
  resetDeps: React.DependencyList = [],
) {
  const [page, setPage] = React.useState(1);

  const totalItems = items.length;
  const { start, end, totalPages } = getPaginationRange(page, pageSize, totalItems);

  React.useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageItems = React.useMemo(
    () => items.slice(start, end),
    [items, start, end],
  );

  return {
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems,
    pageSize,
    rangeStart: totalItems === 0 ? 0 : start + 1,
    rangeEnd: end,
  };
}
