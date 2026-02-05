/**
 * Notes Quick View Card Component
 * Shows a summary of latest notes in the Details tab
 * Only displays if notes exist
 */

'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Pin, ArrowRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import { getQuoteNotes } from '@/lib/api/quote-notes';
import type { QuoteNote } from '@/lib/types/quotes';

interface NotesQuickViewCardProps {
  quoteId: string;
  onViewAll?: () => void;
}

export function NotesQuickViewCard({
  quoteId,
  onViewAll,
}: NotesQuickViewCardProps) {
  const [notes, setNotes] = useState<QuoteNote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotes();
  }, [quoteId]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await getQuoteNotes(quoteId, 1, 3); // Get latest 3 notes
      setNotes(response.notes);
      setTotal(response.total);
    } catch (error: any) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Don't render if no notes exist
  if (!loading && total === 0) {
    return null;
  }

  // Don't render while loading
  if (loading) {
    return null;
  }

  return (
    <Card className="mb-6">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Recent Notes
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {total} note{total !== 1 ? 's' : ''} on this quote
              </p>
            </div>
          </div>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Notes List */}
        <div className="space-y-3">
          {notes.map((note, index) => (
            <div
              key={note.id}
              className={`p-3 rounded-lg border transition-colors ${
                note.is_pinned
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Note Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {note.is_pinned && (
                    <Pin className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0 fill-current" />
                  )}
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {note.user
                      ? `${note.user.first_name} ${note.user.last_name}`
                      : 'Deleted User'}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {formatDateTime(note.created_at)}
                </span>
              </div>

              {/* Note Content */}
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {truncateText(note.note_text, 150)}
              </p>
            </div>
          ))}
        </div>

        {/* View All Footer (if more notes exist) */}
        {total > 3 && onViewAll && (
          <button
            onClick={onViewAll}
            className="mt-4 w-full py-2 text-sm text-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
          >
            View all {total} notes →
          </button>
        )}
      </div>
    </Card>
  );
}

export default NotesQuickViewCard;
