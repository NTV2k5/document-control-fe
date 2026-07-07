import React from 'react';
import { Skeleton } from 'reactjs-platform/ui';

export const DataTableSkeleton = () => {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-10 w-80" />
            <Skeleton className="size-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {Array.from({ length: 4 })
                .fill(0)
                .map((_, i) => (
                  <tr key={(i + Math.random()).toString()}>
                    <td className="p-4">
                      <Skeleton className="h-6 w-40" />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-6 w-32" />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-6 w-24" />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-6 w-16" />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-6 w-24" />
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Skeleton className="size-8" />
                        <Skeleton className="size-8" />
                        <Skeleton className="size-8" />
                        <Skeleton className="size-8" />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export function DataBodyTableSkeleton() {
  return (
    <div>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <Skeleton className="h-4 w-24" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {Array.from({ length: 4 })
                .fill(0)
                .map((_, i) => (
                  <tr key={(i + Math.random()).toString()}>
                    <td className="p-4">
                      <Skeleton className="h-6 w-40" />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-6 w-32" />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-6 w-24" />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-6 w-16" />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-6 w-24" />
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Skeleton className="size-8" />
                        <Skeleton className="size-8" />
                        <Skeleton className="size-8" />
                        <Skeleton className="size-8" />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
