// Pagination Controls Component
// Reusable pagination UI for lists and tables

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onNext: () => void;
  onPrevious: () => void;
  onGoToPage?: (page: number) => void;
  className?: string;
}

/**
 * Pagination controls with Previous/Next buttons and page indicator
 *
 * Layout: [← Previous] Page 1 of 15 [Next →]
 *
 * Features:
 * - Disabled state for first/last page
 * - Optional page number input for jumping to specific page
 * - Responsive design
 *
 * @example
 * ```tsx
 * <PaginationControls
 *   currentPage={1}
 *   totalPages={10}
 *   onNext={() => setPage(p => p + 1)}
 *   onPrevious={() => setPage(p => p - 1)}
 * />
 * ```
 */
export function PaginationControls({
  currentPage,
  totalPages,
  onNext,
  onPrevious,
  onGoToPage,
  className = ''
}: PaginationControlsProps) {
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      {/* Previous Button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={onPrevious}
        disabled={isFirstPage}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Previous</span>
      </Button>

      {/* Page Indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span className="font-medium">
          Page {currentPage} of {totalPages}
        </span>

        {/* Optional: Jump to page input */}
        {onGoToPage && totalPages > 5 && (
          <div className="hidden md:flex items-center gap-2 ml-4">
            <span className="text-gray-500">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              defaultValue={currentPage}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = parseInt((e.target as HTMLInputElement).value);
                  if (value >= 1 && value <= totalPages) {
                    onGoToPage(value);
                  }
                }
              }}
              className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Next Button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={onNext}
        disabled={isLastPage}
        className="flex items-center gap-2"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
