/**
 * Module Status Card Component
 * Reusable card for displaying Twilio module status on dashboard
 *
 * Features:
 * - Icon and title
 * - Status badge (configured, not configured, error)
 * - Module details (phone number, counts, etc.)
 * - Action button linking to module page
 * - Loading and error states
 * - Dark mode support
 * - Mobile responsive
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type StatusVariant = 'success' | 'warning' | 'gray' | 'danger' | 'info';

interface ModuleStatusCardProps {
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Module title */
  title: string;
  /** Status badge text */
  statusText?: string;
  /** Status badge variant */
  statusVariant?: StatusVariant;
  /** Module details (phone number, count, etc.) */
  details?: string[];
  /** Action button text */
  actionText: string;
  /** Action button link */
  actionLink: string;
  /** Card background color class */
  colorClass: string;
  /** Icon color class */
  iconColorClass: string;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string;
}

export function ModuleStatusCard({
  icon: Icon,
  title,
  statusText,
  statusVariant = 'gray',
  details = [],
  actionText,
  actionLink,
  colorClass,
  iconColorClass,
  isLoading = false,
  error,
}: ModuleStatusCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <div className="p-6 flex flex-col h-full space-y-4">
        {/* Header: Icon, Title, Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-3 rounded-lg flex-shrink-0 ${colorClass}`}>
              <Icon className={`w-6 h-6 ${iconColorClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {title}
              </h3>
            </div>
          </div>
          {statusText && !isLoading && !error && (
            <Badge variant={statusVariant} className="flex-shrink-0">
              {statusText}
            </Badge>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Link href={actionLink}>
              <Button variant="secondary" size="sm">
                Try Again
              </Button>
            </Link>
          </div>
        )}

        {/* Details */}
        {!isLoading && !error && (
          <>
            <div className="flex-1 space-y-2">
              {details.length > 0 ? (
                details.map((detail, index) => (
                  <p key={index} className="text-sm text-gray-600 dark:text-gray-400">
                    {detail}
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                  No configuration details available
                </p>
              )}
            </div>

            {/* Action Button */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <Link href={actionLink} className="block">
                <Button variant="secondary" size="sm" className="w-full">
                  {actionText}
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
