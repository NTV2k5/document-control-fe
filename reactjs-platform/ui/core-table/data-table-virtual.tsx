'use client';

import type { SortingState } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';

import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

type DatatableVirtualProps = {
  columns: any[];
  data: any[];
  height?: number;
  estimateRowSize?: number;
  overscan?: number;
};

// This is a dynamic row height example, which is more complicated, but allows for a more realistic table.
// See https://tanstack.com/virtual/v3/docs/examples/react/table for a simpler fixed row height example.
export function DatatableVirtual({ columns, data }: DatatableVirtualProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
  });

  const { rows } = table.getRowModel();

  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 20,
  });

  return (
    <div ref={parentRef} className="container">
      <div className="overflow-auto" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <th key={header.id} colSpan={header.colSpan} style={{ width: header.getSize() }}>
                      {header.isPlaceholder ? null : (
                        <div
                          {...{
                            className: header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                            onClick: header.column.getToggleSortingHandler(),
                          }}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' 🔼',
                            desc: ' 🔽',
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {virtualizer.getVirtualItems().map((virtualRow, index) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row?.id || Math.random() * 1000}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start - index * virtualRow.size}px)`,
                  }}>
                  {row?.getVisibleCells().map((cell) => {
                    return <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
