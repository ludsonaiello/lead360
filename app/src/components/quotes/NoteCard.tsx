/**
 * Note Card Component
 * Displays a single quote note with actions
 */

'use client';

import React from 'react';
import { Pin, Edit, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { QuoteNote } from '@/lib/types/quotes';

interface NoteCardProps {
  note: QuoteNote;
  isPinned: boolean;
  canEdit: boolean;
  onTogglePin: (noteId: string, isPinned: boolean) => void;
  onEdit: (note: QuoteNote) => void;
  onDelete: (note: QuoteNote) => void;
}

export function NoteCard({
  note,
  isPinned,
  canEdit,
  onTogglePin,
  onEdit,
  onDelete,
}: NoteCardProps) {
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getUserName = (): string => {
    if (!note.user) {
      return 'Deleted User';
    }
    return `${note.user.first_name} ${note.user.last_name}`;
  };

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        isPinned
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* User Info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {getUserName()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDateTime(note.created_at)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Pin Button */}
          <button
            onClick={() => onTogglePin(note.id, !isPinned)}
            disabled={!canEdit}
            className={`p-2 rounded transition-colors ${
              isPinned
                ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isPinned ? 'Unpin note' : 'Pin note to top'}
          >
            <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
          </button>

          {/* Edit Button */}
          {canEdit && (
            <button
              onClick={() => onEdit(note)}
              className="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              title="Edit note"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}

          {/* Delete Button */}
          {canEdit && (
            <button
              onClick={() => onDelete(note)}
              className="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Delete note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Note Content */}
      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
        {note.note_text}
      </div>

      {/* Updated Indicator */}
      {note.updated_at !== note.created_at && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            Last edited: {formatDateTime(note.updated_at)}
          </p>
        </div>
      )}
    </div>
  );
}

export default NoteCard;
