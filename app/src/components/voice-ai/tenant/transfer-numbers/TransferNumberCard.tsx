'use client';

// ============================================================================
// TransferNumberCard Component
// ============================================================================
// Display card for a single transfer number with actions
// ============================================================================

import React from 'react';
import { Phone, Edit, Trash2, GripVertical, Star } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TransferNumber } from '@/lib/types/voice-ai';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface TransferNumberCardProps {
  transferNumber: TransferNumber;
  canEdit: boolean;
  onEdit: (transferNumber: TransferNumber) => void;
  onDelete: (transferNumber: TransferNumber) => void;
}

/**
 * TransferNumberCard - Display card for transfer number with drag-drop
 */
export function TransferNumberCard({
  transferNumber,
  canEdit,
  onEdit,
  onDelete,
}: TransferNumberCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: transferNumber.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Format phone number for display (E.164 to US format)
  const formatPhoneNumber = (phone: string): string => {
    // Remove +1 prefix
    const cleaned = phone.replace(/^\+1/, '');
    if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Parse and format available hours
  const formatAvailableHours = (hours: string | null): string => {
    if (!hours) return 'Always available';

    try {
      const parsed = JSON.parse(hours);
      const days = Object.keys(parsed);

      if (days.length === 0) return 'Always available';

      // Show first day as example
      const firstDay = days[0];
      const dayName = {
        mon: 'Mon',
        tue: 'Tue',
        wed: 'Wed',
        thu: 'Thu',
        fri: 'Fri',
        sat: 'Sat',
        sun: 'Sun',
      }[firstDay] || firstDay;

      const times = parsed[firstDay];
      if (Array.isArray(times) && times.length > 0) {
        // Handle both formats for backwards compatibility
        const firstRange = times[0];

        if (Array.isArray(firstRange)) {
          // New format: [["09:00", "17:00"]]
          const [open, close] = firstRange;
          return `${dayName}: ${open}-${close}${days.length > 1 ? ` (+${days.length - 1} more)` : ''}`;
        } else if (typeof firstRange === 'object' && 'open' in firstRange) {
          // Old format: [{open: "09:00", close: "17:00"}]
          return `${dayName}: ${firstRange.open}-${firstRange.close}${days.length > 1 ? ` (+${days.length - 1} more)` : ''}`;
        }
      } else if (typeof times === 'object' && 'open' in times) {
        // Very old format: {open: "09:00", close: "17:00"}
        return `${dayName}: ${times.open}-${times.close}${days.length > 1 ? ` (+${days.length - 1} more)` : ''}`;
      }

      return 'Custom hours';
    } catch (e) {
      return 'Invalid hours format';
    }
  };

  // Get transfer type badge color
  const getTransferTypeBadge = (type: string) => {
    const colors = {
      primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      overflow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      after_hours: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      emergency: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };

    const labels = {
      primary: 'Primary',
      overflow: 'Overflow',
      after_hours: 'After Hours',
      emergency: 'Emergency',
    };

    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${colors[type as keyof typeof colors] || colors.primary}`}>
        {labels[type as keyof typeof labels] || type}
      </span>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700
        rounded-lg p-4 shadow-sm hover:shadow-md transition-all
        ${isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        {canEdit && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-1"
          >
            <GripVertical className="h-5 w-5" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {transferNumber.label}
              </h3>
              {transferNumber.is_default && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex-shrink-0">
              {getTransferTypeBadge(transferNumber.transfer_type)}
            </div>
          </div>

          {/* Phone Number */}
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-2">
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">{formatPhoneNumber(transferNumber.phone_number)}</span>
          </div>

          {/* Description */}
          {transferNumber.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {transferNumber.description}
            </p>
          )}

          {/* Available Hours */}
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
            Available: {formatAvailableHours(transferNumber.available_hours)}
          </p>

          {/* Actions */}
          {canEdit && (
            <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(transferNumber)}
                className="text-sm"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(transferNumber)}
                className="text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Default Badge */}
      {transferNumber.is_default && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
            <Star className="h-3.5 w-3.5 fill-yellow-500" />
            <span className="font-medium">Default Transfer Number</span>
          </div>
        </div>
      )}
    </div>
  );
}
