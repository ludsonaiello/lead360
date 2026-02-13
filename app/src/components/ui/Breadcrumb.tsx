/**
 * Breadcrumb Component
 * Navigation breadcrumbs for showing current page hierarchy
 *
 * Features:
 * - Clickable breadcrumb items (except current page)
 * - Chevron separators
 * - Mobile responsive (shows last 2 items on small screens)
 * - Dark mode support
 * - Accessibility (ARIA labels, semantic HTML)
 */

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string; // Optional href (current page has no href)
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean; // Show home icon as first item
  homeHref?: string; // Home link href (default: '/dashboard')
  className?: string;
}

/**
 * Breadcrumb component for navigation hierarchy
 *
 * @example
 * <Breadcrumb
 *   items={[
 *     { label: 'Communications', href: '/communications' },
 *     { label: 'Twilio', href: '/communications/twilio' },
 *     { label: 'SMS Configuration' } // Current page (no href)
 *   ]}
 *   showHome
 * />
 */
export function Breadcrumb({
  items,
  showHome = true,
  homeHref = '/dashboard',
  className = '',
}: BreadcrumbProps) {
  // Combine home item with provided items
  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Home', href: homeHref }, ...items]
    : items;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center space-x-1 text-sm ${className}`}
    >
      <ol className="flex items-center space-x-1">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isHome = showHome && index === 0;

          return (
            <li key={index} className="flex items-center space-x-1">
              {/* Separator (except for first item) */}
              {index > 0 && (
                <ChevronRight
                  className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
                  aria-hidden="true"
                />
              )}

              {/* Breadcrumb item */}
              {isLast ? (
                // Current page - not clickable
                <span
                  className="font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-none"
                  aria-current="page"
                >
                  {isHome ? <Home className="w-4 h-4" aria-label="Home" /> : item.label}
                </span>
              ) : (
                // Clickable breadcrumb link
                <Link
                  href={item.href!}
                  className="text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate max-w-[150px] sm:max-w-none"
                >
                  {isHome ? (
                    <Home className="w-4 h-4" aria-label="Home" />
                  ) : (
                    <span className="hidden sm:inline">{item.label}</span>
                  )}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Breadcrumb Skeleton Loader
 * Shows loading state for breadcrumbs
 */
export function BreadcrumbSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="flex items-center space-x-2 animate-pulse">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-2">
          {index > 0 && (
            <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          )}
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

export default Breadcrumb;
