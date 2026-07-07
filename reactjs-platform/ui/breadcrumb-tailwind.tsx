'use client';

import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  homeIcon?: React.ReactNode;
  className?: string;
}

const defaultSeparator = <ChevronRight className="size-3 text-gray-500" />;

export const BreadcrumbTailwind = ({
  items,
  separator = defaultSeparator,
  className = 'flex items-center gap-2',
}: BreadcrumbProps) => {
  return (
    <nav className={className} aria-label="Breadcrumb">
      <ol className="flex items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${item.href ?? ''}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center text-sm text-gray-500 hover:text-amber-600 transition-colors"
                  to={'.'}>
                  {item.icon && <span className="mr-1">{item.icon}</span>}
                  {item.label}
                </Link>
              ) : (
                <span className={`flex items-center text-sm ${isLast ? 'text-navy font-medium' : 'text-gray-500'}`}>
                  {item.icon && <span className="mr-1">{item.icon}</span>}
                  {item.label}
                </span>
              )}

              {!isLast && (
                <span className="text-gray-500" aria-hidden="true">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Hook helper để tạo breadcrumb items dễ dàng hơn
export function useBreadcrumb() {
  const createBreadcrumbItems = (paths: Array<{ label: string; href?: string; icon?: React.ReactNode }>) => {
    return paths;
  };

  return { createBreadcrumbItems };
}
