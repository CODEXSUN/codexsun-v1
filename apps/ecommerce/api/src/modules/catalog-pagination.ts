export const CATALOG_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const CATALOG_ALL_ROWS_THRESHOLD = 100;

export type CatalogPageWindow = {
  page: number;
  pageSize: number;
};

export function resolveCatalogPageWindow(
  total: number,
  requestedPage: number | undefined,
  requestedPageSize: number | undefined
): CatalogPageWindow {
  const safeTotal = Math.max(0, Math.trunc(total));
  if (safeTotal <= CATALOG_ALL_ROWS_THRESHOLD) {
    return { page: 1, pageSize: CATALOG_ALL_ROWS_THRESHOLD };
  }
  const requested = Math.trunc(requestedPageSize ?? CATALOG_ALL_ROWS_THRESHOLD);
  const pageSize = CATALOG_PAGE_SIZE_OPTIONS.find((option) => option === requested) ?? 100;
  const pageCount = Math.max(1, Math.ceil(safeTotal / pageSize));
  return {
    page: Math.min(Math.max(1, Math.trunc(requestedPage ?? 1)), pageCount),
    pageSize
  };
}
