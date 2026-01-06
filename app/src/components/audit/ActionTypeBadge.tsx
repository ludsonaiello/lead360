// Action Type Badge Component
// Displays action type with icon and color coding

import { ActionType } from '@/lib/types/audit';
import { getActionIcon, getActionColorClasses } from '@/lib/utils/audit-helpers';

interface ActionTypeBadgeProps {
  actionType: ActionType;
  className?: string;
}

/**
 * Badge component for displaying audit log action types
 *
 * Visual Design:
 * - created: Green badge with Plus icon
 * - updated: Blue badge with Edit icon
 * - deleted: Red badge with Trash icon
 * - accessed: Gray badge with Eye icon
 * - failed: Red badge with X icon
 *
 * @example
 * ```tsx
 * <ActionTypeBadge actionType="created" />
 * <ActionTypeBadge actionType="updated" />
 * ```
 */
export function ActionTypeBadge({ actionType, className = '' }: ActionTypeBadgeProps) {
  const Icon = getActionIcon(actionType);
  const colorClasses = getActionColorClasses(actionType);

  // Capitalize first letter
  const label = actionType.charAt(0).toUpperCase() + actionType.slice(1);

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${colorClasses}
        ${className}
      `}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
