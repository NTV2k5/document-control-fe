export interface IPagination {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type PageSizePagination = IPagination;

export const extractPageSize = (pagination: IPagination): number => pagination.page_size;
