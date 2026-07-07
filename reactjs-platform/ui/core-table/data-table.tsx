'use client';

import type { ColumnDef, ColumnFiltersState, OnChangeFn, RowSelectionState, SortingState } from '@tanstack/react-table';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import React, { useState } from 'react';
import { PaginationTable } from 'reactjs-platform/ui/core-table/pagination-table';
import { PageSizeSelector } from 'reactjs-platform/ui/core-table/page-size-selector';
import { DEFAULT_PAGE_SIZE, type PageSizeOption } from 'reactjs-platform/ui/core-table/config';
import { cn } from 'reactjs-platform/utilities';
import type { IPagination } from '../../../src/models';
import { extractPageSize } from '../../../src/models/pagination/pagination.model';

export type PaginationInfo = IPagination;

// Extend ColumnDef để thêm custom classes và freeze
declare module '@tanstack/react-table' {
  // eslint-disable-next-line unused-imports/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
    headerClassName?: string;
    cellClassName?: string;
    // Freeze column options
    frozen?: 'left' | 'right';
    frozenWidth?: number; // Width in pixels for frozen column
  }
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchable?: boolean;
  searchPlaceholder?: string;
  page_size?: number;
  className?: string;
  // Server-side sorting
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  // Server-side pagination
  hidePagination?: boolean;
  pagination?: PaginationInfo;
  onPaginationChange?: (updater: (prev: PaginationInfo) => PaginationInfo) => void;
  // Row selection
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  enableRowSelection?: boolean | ((row: any) => boolean);
  // Loading state
  loading?: boolean;
  // Freeze columns
  enableFreezeColumns?: boolean;
  // Fixed header
  fixedHeader?: boolean;
  maxHeight?: number;
  // Row styling
  getRowClassName?: (row: TData) => string;
  // Custom page size options
  pageSizeOptions?: readonly number[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  // searchable = true,
  // searchPlaceholder = 'Tìm kiếm...',
  page_size = DEFAULT_PAGE_SIZE,
  className = '',
  // Server-side props
  sorting: externalSorting,
  onSortingChange,
  // pagination
  hidePagination = false,
  pagination: externalPagination,
  onPaginationChange,
  // Row selection props
  rowSelection,
  onRowSelectionChange,
  enableRowSelection: enableRowSelectionProp,
  loading = false,
  enableFreezeColumns = false,
  fixedHeader = false,
  maxHeight,
  // Row styling
  getRowClassName,
  pageSizeOptions,
}: DataTableProps<TData, TValue>) {
  // Use external sorting if provided, otherwise use internal state
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});

  const currentSorting = externalSorting ?? internalSorting;
  const handleSortingChange: OnChangeFn<SortingState> = onSortingChange ?? setInternalSorting;

  const currentRowSelection = rowSelection ?? internalRowSelection;
  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = onRowSelectionChange ?? setInternalRowSelection;

  // Server-side configuration
  const isServerSide = onSortingChange !== undefined || externalPagination !== undefined;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: isServerSide ? undefined : getPaginationRowModel(),
    getSortedRowModel: isServerSide ? undefined : getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: handleRowSelectionChange,
    globalFilterFn: 'includesString',
    // Server-side configuration
    manualSorting: isServerSide,
    manualPagination: isServerSide,
    pageCount: externalPagination ? externalPagination.total_pages : undefined,
    enableRowSelection: enableRowSelectionProp ?? true,
    state: {
      sorting: currentSorting,
      columnFilters,
      globalFilter,
      rowSelection: currentRowSelection,
      pagination: externalPagination
        ? {
            pageIndex: externalPagination.page - 1, // Convert to 0-based index
            pageSize: extractPageSize(externalPagination),
          }
        : {
            pageIndex: 0,
            pageSize: page_size,
          },
    },
    initialState: {
      pagination: {
        pageSize: page_size,
      },
    },
  });

  // Default pagination for client-side
  const defaultPagination: PaginationInfo = {
    page: table.getState().pagination.pageIndex + 1,
    page_size: table.getState().pagination.pageSize,
    total: table.getFilteredRowModel().rows.length,
    total_pages: table.getPageCount(),
  };

  // Handle pagination change for PaginationTable component
  const handlePaginationTableChange = (updater: (prev: PaginationInfo) => PaginationInfo) => {
    if (onPaginationChange) {
      onPaginationChange(updater);
    } else {
      // For client-side, we need to handle pagination through table
      const currentPagination = defaultPagination;
      const newPagination = updater(currentPagination);

      // Update table pagination state
      if (newPagination.page !== currentPagination.page) {
        table.setPageIndex(newPagination.page - 1);
      }

      const newPageSize = extractPageSize(newPagination);
      const currentPageSize = extractPageSize(currentPagination);
      if (newPageSize !== currentPageSize) {
        table.setPageSize(newPageSize);
      }
    }
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: PageSizeOption) => {
    if (onPaginationChange) {
      // Server-side pagination
      onPaginationChange((prev) => {
        const currentPage = prev.page;
        const total = prev.total || 0;
        const newTotalPages = Math.ceil(total / newPageSize);

        // Keep current page if it's still valid, otherwise reset to 1
        const validPage = currentPage <= newTotalPages ? currentPage : 1;

        return {
          ...prev,
          page_size: newPageSize,
          page: validPage,
        };
      });
    } else {
      // Client-side pagination
      const currentPageIndex = table.getState().pagination.pageIndex;
      const totalRows = table.getFilteredRowModel().rows.length;
      const newTotalPages = Math.ceil(totalRows / newPageSize);

      // Keep current page if it's still valid, otherwise reset to 0
      const validPageIndex = currentPageIndex < newTotalPages ? currentPageIndex : 0;

      table.setPageSize(newPageSize);
      table.setPageIndex(validPageIndex);
    }
  };

  // Calculate frozen column positions
  const getFrozenColumnStyle = (columnOrHeader: any, index: number) => {
    // Handle both header and cell cases
    const column = columnOrHeader?.column || columnOrHeader;
    const columnDef = column?.columnDef;

    if (!enableFreezeColumns || !columnDef?.meta?.frozen) {
      return {};
    }

    // const boxShadow = '4px 0 6px -2px rgba(0, 0, 0, 0.1)';

    const frozen = columnDef.meta.frozen;
    const frozenWidth = columnDef.meta.frozenWidth || 150;

    if (frozen === 'left') {
      // Calculate left offset for left-frozen columns
      let leftOffset = 0;
      const headers = table.getHeaderGroups()[0]?.headers || [];

      for (let i = 0; i < index; i++) {
        const prevHeader = headers[i];
        if (prevHeader?.column?.columnDef?.meta?.frozen === 'left') {
          leftOffset += prevHeader.column.columnDef.meta?.frozenWidth || 150;
        } else {
          break;
        }
      }

      return {
        position: 'sticky' as const,
        left: leftOffset,
        zIndex: 10,
        backgroundColor: 'white',
        borderRight: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        boxSizing: 'border-box' as const,
        width: frozenWidth,
        minWidth: frozenWidth,
        maxWidth: frozenWidth,
        overflow: 'hidden',
      };
    }

    if (frozen === 'right') {
      // Calculate right offset for right-frozen columns
      let rightOffset = 0;
      const headers = table.getHeaderGroups()[0]?.headers || [];

      for (let i = headers.length - 1; i > index; i--) {
        const nextHeader = headers[i];
        if (nextHeader?.column?.columnDef?.meta?.frozen === 'right') {
          rightOffset += nextHeader.column.columnDef.meta?.frozenWidth || 150;
        } else {
          break;
        }
      }

      return {
        position: 'sticky' as const,
        right: rightOffset,
        zIndex: 10,
        backgroundColor: 'white',
        borderLeft: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        boxSizing: 'border-box' as const,
        width: frozenWidth,
        minWidth: frozenWidth,
        maxWidth: frozenWidth,
        overflow: 'hidden',
      };
    }

    return {};
  };

  return (
    <div className={cn(`space-y-4`, className)}>
      {/* Table */}
      <div className={cn(`rounded-lg bg-white shadow-sm relative border border-gray-100`, loading && 'opacity-50')}>
        {/* Loading indicator - Only in table area */}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90 backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-sm text-gray-700 bg-white px-4 py-3 rounded-lg shadow-lg border">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
              <span>Loading...</span>
            </div>
          </div>
        )}

        <div
          className={cn(
            loading ? 'overflow-hidden' : 'overflow-auto',
            'relative',
            fixedHeader && (maxHeight ? `max-h-[${maxHeight}px}` : 'max-h-[600px]'), // Only add max-height when fixedHeader is enabled
          )}
          style={{
            maxHeight: fixedHeader ? `${maxHeight ?? 600}px` : 'auto',
          }}>
          <table className="min-w-full table-auto border-collapse rounded-lg">
            <thead
              className={cn(
                fixedHeader && 'sticky top-0 z-20 bg-gray-50', // Fixed header styling
              )}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-gray-200 bg-gray-50">
                  {headerGroup.headers.map((header, index) => (
                    <th
                      key={header.id}
                      style={getFrozenColumnStyle(header, index)}
                      className={cn(
                        'px-4 py-3 font-bold whitespace-nowrap text-xs text-gray-700 uppercase tracking-wider',
                        enableFreezeColumns && header.column?.columnDef?.meta?.frozen && 'overflow-hidden',
                        enableFreezeColumns &&
                          header.column?.columnDef?.meta?.frozen === 'left' &&
                          'relative before:content-[""] before:absolute before:inset-y-0 before:right-0 before:w-[1px] before:bg-gray-200 before:pointer-events-none',
                        enableFreezeColumns &&
                          header.column?.columnDef?.meta?.frozen === 'right' &&
                          'relative before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-[1px] before:bg-gray-200 before:pointer-events-none',
                      )}>
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex space-x-1',
                            header.column?.columnDef?.meta?.headerClassName,
                            header.column?.columnDef?.meta?.className,
                            header.column.getCanSort() &&
                              'cursor-pointer select-none transition-colors hover:text-gray-700',
                          )}
                          onClick={header.column.getToggleSortingHandler()}>
                          <span className="">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {header.column.getCanSort() && (
                            <span className="ml-1 flex flex-col">
                              <ChevronUpIcon
                                className={`size-3 transition-colors ${
                                  header.column.getIsSorted() === 'asc'
                                    ? 'text-blue-600'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                              />
                              <ChevronDownIcon
                                className={`-mt-1 size-3 transition-colors ${
                                  header.column.getIsSorted() === 'desc'
                                    ? 'text-blue-600'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                              />
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="table-core-ui divide-y divide-gray-200 bg-white">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  const customRowClassName = getRowClassName ? getRowClassName(row.original) : '';
                  return (
                    <tr
                      key={row.id}
                      className={cn('transition-colors duration-150', customRowClassName || 'hover:bg-gray-50')}>
                      {row.getVisibleCells().map((cell, index) => (
                        <td
                          key={cell.id}
                          style={getFrozenColumnStyle(cell, index)}
                          className={cn(
                            'relative',
                            'px-4 py-4 whitespace-nowrap text-sm text-gray-900',
                            cell.column?.columnDef?.meta?.cellClassName,
                            cell.column?.columnDef?.meta?.className,
                            enableFreezeColumns && cell.column?.columnDef?.meta?.frozen && 'overflow-hidden',
                            enableFreezeColumns &&
                              cell.column?.columnDef?.meta?.frozen === 'left' &&
                              'before:content-[""] before:absolute before:inset-y-0 before:right-0 before:w-[1px] before:bg-gray-200 before:pointer-events-none',
                            enableFreezeColumns &&
                              cell.column?.columnDef?.meta?.frozen === 'right' &&
                              'before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-[1px] before:bg-gray-200 before:pointer-events-none',
                          )}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center text-sm text-gray-500">
                    {loading ? 'Loading...' : 'No data'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!hidePagination && (
        <div className="sticky inset-x-0 bottom-0 flex flex-wrap gap-2 items-center justify-between bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">
              Total records:{' '}
              <span className="font-bold text-navy">{(externalPagination || defaultPagination)?.total}</span> |
            </div>

            <PageSizeSelector
              value={extractPageSize(externalPagination || defaultPagination)}
              onChange={handlePageSizeChange}
              disabled={loading}
              options={pageSizeOptions}
            />
          </div>
          <div className="flex items-center gap-1">
            {/* Pagination */}
            <PaginationTable
              pagination={externalPagination || defaultPagination}
              setPagination={handlePaginationTableChange}
              disabled={loading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
