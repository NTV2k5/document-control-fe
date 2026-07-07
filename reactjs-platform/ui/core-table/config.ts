/**
 * Configuration file for DataTable pagination settings
 */

export const PAGE_SIZE_OPTIONS = [10, 15, 20, 50] as const;

export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
