// Status Badge Component
// Displays success/failure status with icon

import { Status } from '@/lib/types/audit';
import { getStatusIcon, getStatusColorClasses } from '@/lib/utils/audit-helpers';

interface StatusBadgeProps {
  status: Status;
  className?: string;
  showLabel?: boolean;
}

/**
 * Badge component for displaying audit log status
 *
 * Visual Design:
 * - success: Green checkmark icon
 * - failure: Red X icon
 *
 * @example
 * ```tsx
 * <StatusBadge status="success" />
 * <StatusBadge status="failure" showLabel />
 * ```
 */
export function StatusBadge({ status, className = '', showLabel = false }: StatusBadgeProps) {
  const Icon = getStatusIcon(status);
  const colorClasses = getStatusColorClasses(status);

  const label = status === 'success' ? 'Success' : 'Failed';

  return (
    <span
      className={`inline-flex items-center gap-1 ${colorClasses} ${className}`}
      title={label}
    >
      <Icon className="h-4 w-4" />
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </span>
  );
}
