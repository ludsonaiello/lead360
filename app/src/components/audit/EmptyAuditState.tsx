// Empty State Component for Audit Logs
// Displayed when no logs are found

import { FileText } from 'lucide-react';

interface EmptyAuditStateProps {
  message?: string;
  suggestion?: string;
}

/**
 * Empty state component shown when no audit logs are found
 *
 * @example
 * ```tsx
 * <EmptyAuditState />
 * <EmptyAuditState
 *   message="No logs found for this user"
 *   suggestion="Try adjusting the date range"
 * />
 * ```
 */
export function EmptyAuditState({
  message = 'No audit logs found',
  suggestion = 'Try adjusting your filters or date range to see more results'
}: EmptyAuditStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
        <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>

      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        {message}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
        {suggestion}
      </p>
    </div>
  );
}
