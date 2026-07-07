import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Button } from 'reactjs-platform/ui';

interface PaginationProps {
  pagination: {
    page: number;
    total_pages: number;
    total: number;
    page_size: number;
  };
  setPagination: (updater: (prev: any) => any) => void;
  maxVisible?: number;
  disabled?: boolean;
}

export const PaginationTable = ({ pagination, setPagination, maxVisible = 5, disabled = false }: PaginationProps) => {
  const normalizedPagination = useMemo(
    () => ({
      page: Math.max(1, pagination.page),
      total_pages: Math.max(0, pagination.total_pages),
      total: Math.max(0, pagination.total),
      page_size: Math.max(1, pagination.page_size),
    }),
    [pagination],
  );

  const { page: currentPage, total_pages } = normalizedPagination;

  // Tính toán range của các số trang hiển thị
  const pageNumbers = useMemo(() => {
    // Return an empty array if no pages
    if (total_pages === 0) {
      return [];
    }

    // If total pages <= maxVisible, show all
    if (total_pages <= maxVisible) {
      return Array.from({ length: total_pages }, (_, i) => i + 1);
    }

    // Enhanced pagination logic: 1 ... middle pages ... current pages
    const pages = new Set<number>();

    // Always show first page
    pages.add(1);

    // Show middle pages (around total/2)
    const middlePosition = Math.floor(total_pages / 2);
    const middleRange = 1; // Show 1 page before and after a middle
    for (
      let i = Math.max(2, middlePosition - middleRange);
      i <= Math.min(total_pages - 1, middlePosition + middleRange);
      i++
    ) {
      pages.add(i);
    }

    // Show pages around current page
    const currentRange = 1; // Show 1 page before and after current
    for (
      let i = Math.max(2, currentPage - currentRange);
      i <= Math.min(total_pages - 1, currentPage + currentRange);
      i++
    ) {
      pages.add(i);
    }

    // Always show last page
    if (total_pages > 1) {
      pages.add(total_pages);
    }

    // Convert set to sorted array
    return Array.from(pages).sort((a, b) => a - b);
  }, [currentPage, total_pages, maxVisible]);

  // Handle page change with validation
  const handlePageChange = useCallback(
    (newPage: number) => {
      const validPage = Math.max(1, Math.min(total_pages, newPage));
      setPagination((prev) => ({ ...prev, page: validPage }));
    },
    [total_pages, setPagination],
  );

  // Early return if no pages
  if (total_pages === 0) {
    return null;
  }

  // Check if we need ellipsis - simplified for new logic
  const lastPageNumber = pageNumbers[pageNumbers.length - 1];

  return (
    <div className="flex items-center gap-1">
      {/* First page button */}
      <Button
        variant="outline"
        size="icon"
        className="size-8 cursor-pointer disabled:cursor-not-allowed"
        onClick={() => handlePageChange(1)}
        disabled={disabled || currentPage === 1}
        aria-label="Go to first page">
        <ChevronsLeft className="size-4" />
      </Button>

      {/* Previous page button */}
      <Button
        variant="outline"
        size="icon"
        className="size-8 cursor-pointer disabled:cursor-not-allowed"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={disabled || currentPage === 1}
        aria-label="Go to previous page">
        <ChevronLeft className="size-4" />
      </Button>

      {/* Page numbers with gap handling */}
      {pageNumbers.map((pageNum, index) => (
        <div key={pageNum} className="flex items-center gap-1">
          {/* Show ellipsis if there's a gap before this page */}
          {index > 0 && pageNumbers[index - 1] !== undefined && pageNum - pageNumbers[index - 1]! > 1 && (
            <span className="px-2 text-gray-400" aria-hidden="true">
              ...
            </span>
          )}

          <Button
            variant={currentPage === pageNum ? 'navy' : 'outline'}
            size="icon"
            className={`w-auto h-8 min-w-8 p-1 cursor-pointer disabled:cursor-not-allowed ${
              currentPage === pageNum ? 'hover:bg-[#002147]/60' : ''
            }`}
            onClick={() => handlePageChange(pageNum)}
            disabled={disabled}
            aria-label={`Go to page ${pageNum}`}
            aria-current={currentPage === pageNum ? 'page' : undefined}>
            {pageNum}
          </Button>
        </div>
      ))}

      {/* Last page if doesn't in range */}
      {lastPageNumber !== undefined && lastPageNumber < total_pages && (
        <Button
          variant="outline"
          size="icon"
          className="w-auto h-8 min-w-8 p-1 cursor-pointer disabled:cursor-not-allowed"
          onClick={() => handlePageChange(total_pages)}
          disabled={disabled}
          aria-label={`Go to page ${total_pages}`}>
          {total_pages}
        </Button>
      )}

      {/* Next page button */}
      <Button
        variant="outline"
        size="icon"
        className="w-auto h-8 min-w-8 p-1 cursor-pointer disabled:cursor-not-allowed"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={disabled || currentPage >= total_pages}
        aria-label="Go to next page">
        <ChevronRight className="size-4" />
      </Button>

      {/* Last page button */}
      <Button
        variant="outline"
        size="icon"
        className="size-8 cursor-pointer disabled:cursor-not-allowed"
        onClick={() => handlePageChange(total_pages)}
        disabled={disabled || currentPage >= total_pages}
        aria-label="Go to last page">
        <ChevronsRight className="size-4" />
      </Button>
    </div>
  );
};
