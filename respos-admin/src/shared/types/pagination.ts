/** Paged list response (CONVENTIONS.md "Pagination / filtering / sorting"). */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: string;
  direction: SortDirection;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
  /** `field:direction`, e.g. `createdAt:desc` */
  sort?: string;
  search?: string;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function toSortParam(sort: SortState | null | undefined): string | undefined {
  return sort ? `${sort.field}:${sort.direction}` : undefined;
}

export function totalPages(result: Pick<PagedResult<unknown>, 'pageSize' | 'totalCount'>): number {
  return Math.max(1, Math.ceil(result.totalCount / Math.max(1, result.pageSize)));
}
