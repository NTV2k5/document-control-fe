'use client';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ColumnDef, ColumnFiltersState, OnChangeFn, SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { PaginationTable } from 'reactjs-platform/ui/core-table/pagination-table';
import { cn } from 'reactjs-platform/utilities';

// Pagination type để match với PaginationTable component
interface PaginationInfo {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

// Extend ColumnDef để thêm custom classes và freeze
declare module '@tanstack/react-table' {
  // eslint-disable-next-line unused-imports/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
    headerClassName?: string;
    cellClassName?: string;
    frozen?: 'left' | 'right';
    frozenWidth?: number; // Width in pixels for a frozen column
  }
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  page_size?: number;
  className?: string;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  pagination?: PaginationInfo;
  onPaginationChange?: (updater: (prev: PaginationInfo) => PaginationInfo) => void;
  loading?: boolean;
  enableFreezeColumns?: boolean;
  fixedHeader?: boolean;
}

export function DataTableV2<TData, TValue>({
  columns,
  data,
  page_size = 10,
  className = '',
  sorting: externalSorting,
  onSortingChange,
  pagination: externalPagination,
  onPaginationChange,
  loading = false,
  enableFreezeColumns = false,
  fixedHeader = false,
}: DataTableProps<TData, TValue>) {
  // The virtualizer will need a reference to the scrollable container element
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const currentSorting = externalSorting ?? internalSorting;
  const handleSortingChange: OnChangeFn<SortingState> = onSortingChange ?? setInternalSorting;
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
    manualSorting: isServerSide,
    manualPagination: isServerSide,
    pageCount: externalPagination ? externalPagination.total_pages : undefined,
    state: {
      sorting: currentSorting,
      columnFilters,
      pagination: externalPagination
        ? {
            pageIndex: externalPagination.page - 1,
            pageSize: externalPagination.page_size,
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

  const defaultPagination: PaginationInfo = {
    page: table.getState().pagination.pageIndex + 1,
    page_size: table.getState().pagination.pageSize,
    total: table.getFilteredRowModel().rows.length,
    total_pages: table.getPageCount(),
  };

  const handlePaginationTableChange = (updater: (prev: PaginationInfo) => PaginationInfo) => {
    if (onPaginationChange) {
      onPaginationChange(updater);
    } else {
      const currentPagination = defaultPagination;
      const newPagination = updater(currentPagination);
      if (newPagination.page !== currentPagination.page) {
        table.setPageIndex(newPagination.page - 1);
      }
      if (newPagination.page_size !== currentPagination.page_size) {
        table.setPageSize(newPagination.page_size);
      }
    }
  };

  // Tính style cho cột frozen
  const getFrozenColumnStyle = (columnOrHeader: any, index: number) => {
    const column = columnOrHeader?.column || columnOrHeader;
    const columnDef = column?.columnDef;
    if (!enableFreezeColumns || !columnDef?.meta?.frozen) {
      return {};
    }
    const frozenWidth = columnDef.meta.frozenWidth || 'auto';
    const headers = table.getHeaderGroups()[0]?.headers || [];

    if (columnDef.meta.frozen === 'left') {
      let leftOffset = 0;
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
        borderRight: '2px solid #e5e7eb',
        width: frozenWidth,
        minWidth: frozenWidth,
        maxWidth: frozenWidth,
        background: 'white',
      };
    }

    if (columnDef.meta.frozen === 'right') {
      let rightOffset = 0;
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
        borderLeft: '2px solid #e5e7eb',
        width: frozenWidth,
        minWidth: frozenWidth,
        maxWidth: frozenWidth,
        background: 'white',
      };
    }
    return {
      display: 'flex',
    };
  };
  const columnSizes =
    table
      .getHeaderGroups()[0]
      ?.headers?.map((header) => `${header.getSize() || 150}px`)
      .join(' ') ?? '';

  return (
    <div className={cn('space-y-4', className)}>
      <div className={cn('rounded-md bg-white shadow-sm', loading && 'opacity-50')}>
        <div
          ref={tableContainerRef}
          style={{
            height: '400px', // should be a fixed height
            width: '100%',
          }}
          className={cn('overflow-auto relative', fixedHeader && 'max-h-[600px]')}>
          <table className="min-w-full border-collapse grid1" style={{}}>
            <TableHead
              table={table}
              getFrozenColumnStyle={getFrozenColumnStyle}
              enableFreezeColumns={enableFreezeColumns}
              fixedHeader={fixedHeader}
              columnSizes={columnSizes}
            />
            <TableBody
              table={table}
              getFrozenColumnStyle={getFrozenColumnStyle}
              enableFreezeColumns={enableFreezeColumns}
              tableContainerRef={tableContainerRef}
              columnSizes={columnSizes}
            />
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-white sticky bottom-0">
        <div className="text-sm text-gray-500">
          Total records: <span className="font-bold text-navy">{(externalPagination || defaultPagination)?.total}</span>
        </div>
        <div className="flex items-center gap-1">
          <PaginationTable
            pagination={externalPagination || defaultPagination}
            setPagination={handlePaginationTableChange}
          />
        </div>
      </div>
    </div>
  );
}

function TableHead({ table, getFrozenColumnStyle, fixedHeader }: any) {
  return (
    <thead className={cn('grid1', fixedHeader && 'sticky top-0 z-20 bg-gray-50')}>
      {table.getHeaderGroups().map((headerGroup: any) => (
        <tr
          key={headerGroup.id + Math.random()}
          className="border-b border-gray-200 bg-gray-50 flex w-full"
          style={
            {
              // gridTemplateColumns: columnSizes,
            }
          }>
          {headerGroup.headers.map((header: any, index: number) => (
            <th
              key={header.id + Math.random()}
              style={{
                ...getFrozenColumnStyle(header, index),
                // width: header.getSize(),
              }}
              className={cn(
                'd-flex px-4 py-3 font-semibold whitespace-nowrap text-left text-xs text-gray-500 uppercase tracking-wider flex grow',
                header.column?.columnDef?.meta?.headerClassName,
                header.column?.columnDef?.meta?.className,
              )}
              onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}>
              <div className="flex items-center space-x-1">
                <span className="grow">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                {header.column.getCanSort() && (
                  <span className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 ${header.column.getIsSorted() === 'asc' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 -mt-1 ${header.column.getIsSorted() === 'desc' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    />
                  </span>
                )}
              </div>
            </th>
          ))}
        </tr>
      ))}
    </thead>
  );
}

function TableBody({ table, getFrozenColumnStyle, tableContainerRef, enableFreezeColumns, columnSizes }: any) {
  const parentRef = useRef<HTMLTableSectionElement>(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    estimateSize: () => 33, // estimate row height for accurate scrollbar dragging
    getScrollElement: () => tableContainerRef.current,
    // measure dynamic row height, except in firefox because it measures table border height incorrectly
    measureElement:
      typeof window !== 'undefined' && !navigator.userAgent.includes('Firefox')
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
  });

  return (
    <tbody
      ref={parentRef}
      style={{
        // gridTemplateColumns: columnSizes,
        position: 'relative',
        height: `${rowVirtualizer.getTotalSize()}px`,
      }}
      className="divide-y divide-gray-200 bg-white grid1">
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index];
        return (
          <TableBodyRow
            key={row.id + Math.random()}
            row={row}
            virtualRow={virtualRow}
            rowVirtualizer={rowVirtualizer}
            getFrozenColumnStyle={getFrozenColumnStyle}
            enableFreezeColumns={enableFreezeColumns}
            columnSizes={columnSizes}
          />
        );
      })}
    </tbody>
  );
}

function TableBodyRow({ row, virtualRow, getFrozenColumnStyle, rowVirtualizer }: any) {
  return (
    <tr
      data-index={virtualRow.index} // needed for dynamic row height measurement
      ref={(node) => rowVirtualizer.measureElement(node)} // measure dynamic row height
      style={{
        position: 'absolute',
        top: 0,
        transform: `translateY(${virtualRow.start}px)`, // this should always be a `style` as it changes on scroll
        width: '100%',
        // gridTemplateColumns: columnSizes,
      }}
      className="hover:bg-gray-50 transition-colors duration-150 flex w-full">
      {row.getVisibleCells().map((cell: any, index: number) => (
        <td
          key={cell.id + Math.random()}
          style={{
            ...getFrozenColumnStyle(cell, index),
            // width: cell.column.getSize(),
          }}
          className={cn(
            'px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex grow items-center',
            cell.column?.columnDef?.meta?.cellClassName,
            cell.column?.columnDef?.meta?.className,
          )}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}
