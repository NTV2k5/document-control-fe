import type { OnChangeFn, SortingState } from '@tanstack/react-table';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert từ custom format sang TanStack format
export const convertToTanStackFormat = (customQuery: any) => {
  if (!customQuery.sort_by) {
    return [];
  }

  return [
    {
      id: customQuery.sort_by,
      desc: customQuery.sort_order === 'desc',
    },
  ];
};

// Handler cho sorting change
export const handleSortingChange = (
  updaterOrValue: Parameters<OnChangeFn<SortingState>>[0],
  currentSorting: SortingState,
) => {
  // Handle both function and direct value cases
  const newSorting = typeof updaterOrValue === 'function' ? updaterOrValue(currentSorting) : updaterOrValue;

  // If no sorting or cleared
  if (!newSorting || newSorting.length === 0) {
    return {
      currentSorting: newSorting,
      sort_by: '',
      sort_order: '',
    };
  }

  // Get the first (and typically only) sort
  const sort = newSorting[0];

  return {
    currentSorting: newSorting || [],
    sort_by: sort?.id || '',
    sort_order: sort ? (sort.desc ? 'desc' : 'asc') : '',
  };
};

export function capitalizeFirstLetter(word: unknown): string {
  if (typeof word === 'string' && word.length > 0) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
  return '';
}

export function formatCurrency(currency: string): string {
  if (!currency) {
    return '';
  }

  return currency?.toLocaleString();
}

export function encode64HTML(html: string): string {
  // Browser environment
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(unescape(encodeURIComponent(html)));
  }
  // Node.js environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(html, 'utf8').toString('base64');
  }
  return '';
}
