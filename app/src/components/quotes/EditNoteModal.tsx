/**
 * Edit Note Modal Component
 * Allows editing an existing note
 * Backend: PATCH /quotes/:id/notes/:noteId
 * DTO: UpdateQuoteNoteDto { note_text?: string (max 5000), is_pinned?: boolean }
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { updateQuoteNote } from '@/lib/api/quote-notes';
import type { QuoteNote } from '@/lib/types/quotes';
import toast from 'react-hot-toast';

interface EditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  note: QuoteNote | null;
  onUpdated?: () => void;
}

export function EditNoteModal({
  isOpen,
  onClose,
  quoteId,
  note,
  onUpdated,
}: EditNoteModalProps) {
  const [noteText, setNoteText] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (note) {
      setNoteText(note.note_text);
      setIsPinned(note.is_pinned);
    }
  }, [note]);

  const characterCount = noteText.length;
  const maxCharacters = 5000;
  const hasError = characterCount > maxCharacters;
  const hasChanges =
    note && (noteText.trim() !== note.note_text || isPinned !== note.is_pinned);
  const canSubmit = noteText.trim().length > 0 && !hasError && hasChanges && !loading;

  const handleSubmit = async () => {
    if (!canSubmit || !note) return;

    setLoading(true);
    try {
      await updateQuoteNote(quoteId, note.id, {
        note_text: noteText.trim(),
        is_pinned: isPinned,
      });
      toast.success('Note updated successfully');
      onUpdated?.();
      handleClose();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update note';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && canSubmit) {
      handleSubmit();
    }
  };

  if (!isOpen || !note) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Edit Note
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Update note content or pin status
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Note Text */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Note <span className="text-red-500">*</span>
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your note here..."
              rows={6}
              disabled={loading}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ${
                hasError
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              } disabled:opacity-50`}
            />
            <div className="flex items-center justify-between mt-1">
              {hasError ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Note exceeds maximum length of {maxCharacters.toLocaleString()} characters
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Edit the note content (internal only)
                </p>
              )}
              <p
                className={`text-xs font-medium ${
                  hasError
                    ? 'text-red-600 dark:text-red-400'
                    : characterCount > maxCharacters * 0.9
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {characterCount.toLocaleString()}/{maxCharacters.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Pin Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-pin-note"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50"
            />
            <label
              htmlFor="edit-pin-note"
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              Pin this note to the top
            </label>
          </div>

          {/* Note Metadata */}
          {note.user && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center justify-between">
                  <span>
                    Created by: {note.user.first_name} {note.user.last_name}
                  </span>
                  <span>
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={loading}
            className="min-w-[120px]"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <div className="px-6 pb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press Ctrl+Enter to submit
          </p>
        </div>
      </div>
    </div>
  );
}

export default EditNoteModal;
