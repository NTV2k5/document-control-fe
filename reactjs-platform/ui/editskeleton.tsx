import { Skeleton } from 'reactjs-platform/ui';
import React from 'react';

export function EditSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex">
          {/* Left column skeleton - 1/3 width */}
          <div className="w-1/3 border-r border-gray-200 p-6">
            <Skeleton className="mb-4 h-6 w-40" />

            <div className="mb-6">
              <Skeleton className="mb-2 h-4 w-32" />
              <Skeleton className="size-[120px]" />
            </div>

            <div className="mb-6">
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>

            <div className="mb-6">
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>

            <div className="mb-6">
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-24 w-full" />
            </div>

            <div className="mb-6">
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>

            <div className="mb-6">
              <Skeleton className="mb-1 h-4 w-32" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="mt-2 h-10 w-full" />
              <Skeleton className="mt-2 h-10 w-full" />
              <Skeleton className="mt-2 h-10 w-full" />
            </div>
          </div>

          {/* Right column skeleton - 2/3 width */}
          <div className="w-2/3 p-6">
            <Skeleton className="mb-4 h-6 w-40" />

            <div className="mb-8 grid grid-cols-2 gap-6">
              <div>
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="mb-2 h-6 w-40" />
                <div className="mb-2 grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="mb-2 h-10 w-full" />
                <Skeleton className="mb-2 h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div>
                <Skeleton className="mb-2 h-4 w-32" />
                <div className="mb-2">
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="mb-2">
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="mt-2 h-8 w-32" />
                </div>
              </div>

              <div>
                <Skeleton className="mb-2 h-4 w-32" />
                <div className="mb-4">
                  <Skeleton className="mb-1 h-4 w-24" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-[180px]" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div>
                  <Skeleton className="mb-1 h-4 w-32" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-[180px]" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </div>

              <div>
                <Skeleton className="mb-2 h-4 w-32" />
                <div className="mb-2">
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="mb-2">
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="mb-2">
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>

            <Skeleton className="mb-4 h-6 w-40" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
