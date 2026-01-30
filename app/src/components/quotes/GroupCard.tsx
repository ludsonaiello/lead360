/**
 * GroupCard Component
 * Collapsible group card that displays group information and contains items
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { ItemsList } from './ItemsList';
import { formatMoney } from '@/lib/api/quotes';
import {
  ChevronDown,
  ChevronUp,
  Edit,
  Copy,
  Trash2,
  GripVertical,
} from 'lucide-react';
import type { QuoteGroup, QuoteItem } from '@/lib/types/quotes';

interface GroupCardProps {
  group: QuoteGroup;
  quoteId: string;
  onEdit: (group: QuoteGroup) => void;
  onDelete: (group: QuoteGroup) => void;
  onDuplicate: (group: QuoteGroup) => void;
  onItemEdit: (item: QuoteItem) => void;
  onItemDelete: (item: QuoteItem) => void;
  onItemDuplicate: (item: QuoteItem) => void;
  onItemMove: (item: QuoteItem) => void;
  onItemReorder?: (items: QuoteItem[]) => void;
  onItemUpdate?: () => void;
  readOnly?: boolean;
}

export function GroupCard({
  group,
  quoteId,
  onEdit,
  onDelete,
  onDuplicate,
  onItemEdit,
  onItemDelete,
  onItemDuplicate,
  onItemMove,
  onItemReorder,
  onItemUpdate,
  readOnly = false,
}: GroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card className="overflow-hidden">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          {!readOnly && <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />}
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {group.name}
            </h3>
            {group.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {group.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right mr-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {group.items_count || 0} {group.items_count === 1 ? 'item' : 'items'}
            </p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {formatMoney(group.total_cost || 0)}
            </p>
          </div>

          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </button>

      {/* Group Actions */}
      {isExpanded && !readOnly && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onEdit(group)}>
              <Edit className="w-4 h-4" />
              Edit Group
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDuplicate(group)}>
              <Copy className="w-4 h-4" />
              Duplicate
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(group)}>
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Group Items */}
      {isExpanded && (
        <div className="p-4">
          <ItemsList
            items={group.items}
            quoteId={quoteId}
            onEdit={onItemEdit}
            onDelete={onItemDelete}
            onDuplicate={onItemDuplicate}
            onMoveToGroup={onItemMove}
            onReorder={onItemReorder}
            onItemUpdate={onItemUpdate}
            showGroupActions={true}
            readOnly={readOnly}
          />
        </div>
      )}
    </Card>
  );
}
