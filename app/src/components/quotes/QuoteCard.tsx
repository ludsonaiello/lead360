/**
 * QuoteCard Component
 * Mobile-friendly card display for quote summary with actions
 */

'use client';

import React from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { QuoteStatusBadge } from './QuoteStatusBadge';
import { Button } from '@/components/ui/Button';
import { formatMoney, isQuoteNearExpiration, isQuoteExpired, getCustomerName, getLocation } from '@/lib/api/quotes';
import {
  Eye,
  Edit,
  Copy,
  Trash2,
  AlertTriangle,
  Calendar,
  User,
  MapPin,
} from 'lucide-react';
import type { QuoteSummary } from '@/lib/types/quotes';

interface QuoteCardProps {
  quote: QuoteSummary;
  onAction: (action: 'view' | 'edit' | 'clone' | 'delete', quoteId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
}

export function QuoteCard({
  quote,
  onAction,
  canEdit = true,
  canDelete = true,
  className = '',
}: QuoteCardProps) {
  const nearExpiration = isQuoteNearExpiration(quote.expires_at);
  const expired = isQuoteExpired(quote.expires_at);

  return (
    <Card className={`p-4 hover:shadow-md transition-shadow ${className}`}>
      {/* Header: Quote number and status */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {quote.quote_number}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {quote.title}
          </p>
        </div>
        <QuoteStatusBadge status={quote.status} />
      </div>

      {/* Customer and Location Info */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <User className="w-4 h-4 text-gray-500" />
          <span className="font-medium">{getCustomerName(quote)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <MapPin className="w-4 h-4 text-gray-500" />
          <span>{getLocation(quote)}</span>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mb-3">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {formatMoney(quote.subtotal || 0)}
          </span>
        </div>
        {(quote.tax_amount || 0) > 0 && (
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm text-gray-600 dark:text-gray-400">Tax:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatMoney(quote.tax_amount || 0)}
            </span>
          </div>
        )}
        {(quote.discount_amount || 0) > 0 && (
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm text-gray-600 dark:text-gray-400">Discount:</span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              -{formatMoney(quote.discount_amount || 0)}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Total:
          </span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatMoney(quote.total || 0)}
          </span>
        </div>
      </div>

      {/* Dates and Expiration Warning */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>Created {new Date(quote.created_at).toLocaleDateString()}</span>
          <span>•</span>
          <span>
            Expires {new Date(quote.expires_at).toLocaleDateString()}
          </span>
        </div>

        {/* Expiration Warning */}
        {expired && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-xs font-medium text-red-700 dark:text-red-300">
              Quote expired
            </span>
          </div>
        )}

        {nearExpiration && !expired && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
              Expiring soon
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Link href={`/quotes/${quote.id}`} className="flex-1">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              onAction('view', quote.id);
            }}
          >
            <Eye className="w-4 h-4" />
            View
          </Button>
        </Link>

        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction('edit', quote.id)}
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAction('clone', quote.id)}
          title="Clone"
        >
          <Copy className="w-4 h-4" />
        </Button>

        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction('delete', quote.id)}
            title="Delete"
            className="text-red-600 hover:text-red-700 dark:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

export default QuoteCard;
