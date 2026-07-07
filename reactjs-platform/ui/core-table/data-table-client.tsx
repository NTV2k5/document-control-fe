'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import React, { useMemo } from 'react';
import { Button } from 'reactjs-platform/ui';
import { cn } from 'reactjs-platform/utilities';

// Extend ColumnDef để thêm custom classes như DataTable gốc
declare module '@tanstack/react-table' {
  // eslint-disable-next-line unused-imports/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
    headerClassName?: string;
    cellClassName?: string;
  }
}

interface DataTableClientProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  page_size?: number;
  className?: string;
  fixedHeader?: boolean;
  maxHeight?: number;
}

export function DataTableClient<TData, TValue>({
  columns,
  data,
  page_size = 10,
  className = '',
  fixedHeader = false,
  maxHeight,
}: DataTableClientProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: page_size,
      },
    },
  });

  const currentPage = table.getState().pagination.pageIndex + 1;
  const total_pages = table.getPageCount();
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const maxVisible = 5;
    if (total_pages <= maxVisible) {
      return Array.from({ length: total_pages }, (_, i) => i + 1);
    }

    const pages = new Set<number>();
    pages.add(1);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(total_pages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.add(i);
    }

    if (total_pages > 1) {
      pages.add(total_pages);
    }

    return Array.from(pages).sort((a, b) => a - b);
  }, [currentPage, total_pages]);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn('relative overflow-auto rounded-md border', fixedHeader && maxHeight && `max-h-[${maxHeight}px]`)}
        style={maxHeight ? { maxHeight: `${maxHeight}px` } : {}}>
        <table className="w-full caption-bottom text-sm">
          <thead className={cn('bg-gray-50', fixedHeader && 'sticky top-0 z-10')}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'h-12 px-4 text-left align-middle font-medium text-gray-700',
                      header.column?.columnDef?.meta?.headerClassName,
                      header.column?.columnDef?.meta?.className,
                    )}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'p-4 align-middle',
                        cell.column?.columnDef?.meta?.cellClassName,
                        cell.column?.columnDef?.meta?.className,
                      )}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center">
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Simple Pagination */}
      {total_pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm text-gray-500">
            Showing page {currentPage} of {total_pages} ({data.length} total items)
          </div>

          <div className="flex items-center gap-1">
            {/* First page */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!canPreviousPage}>
              <ChevronsLeft className="size-4" />
            </Button>

            {/* Previous page */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!canPreviousPage}>
              <ChevronLeft className="size-4" />
            </Button>

            {/* Page numbers */}
            {pageNumbers.map((pageNum, index) => {
              const prevPageNum = pageNumbers[index - 1];
              const showEllipsis = prevPageNum && pageNum - prevPageNum > 1;

              return (
                <React.Fragment key={pageNum}>
                  {showEllipsis && <span className="px-2 text-gray-500">...</span>}
                  <Button
                    type="button"
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="icon"
                    className={cn(
                      'w-auto h-8 min-w-8 px-2',
                      currentPage === pageNum && 'bg-navy text-white hover:bg-navy/90',
                    )}
                    onClick={() => table.setPageIndex(pageNum - 1)}>
                    {pageNum}
                  </Button>
                </React.Fragment>
              );
            })}

            {/* Next page */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!canNextPage}>
              <ChevronRight className="size-4" />
            </Button>

            {/* Last page */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(total_pages - 1)}
              disabled={!canNextPage}>
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
