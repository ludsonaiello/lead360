/**
 * Create Note Modal Component
 * Allows creating a new note on a quote
 * Backend: POST /quotes/:id/notes
 * DTO: CreateQuoteNoteDto { note_text: string (max 5000), is_pinned?: boolean }
 */

'use client';

import React, { useState } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createQuoteNote } from '@/lib/api/quote-notes';
import toast from 'react-hot-toast';

interface CreateNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  onCreated?: () => void;
}

export function CreateNoteModal({
  isOpen,
  onClose,
  quoteId,
  onCreated,
}: CreateNoteModalProps) {
  const [noteText, setNoteText] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  const characterCount = noteText.length;
  const maxCharacters = 5000;
  const hasError = characterCount > maxCharacters;
  const canSubmit = noteText.trim().length > 0 && !hasError && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      await createQuoteNote(quoteId, {
        note_text: noteText.trim(),
        is_pinned: isPinned,
      });
      toast.success('Note created successfully');
      onCreated?.();
      handleClose();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to create note';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNoteText('');
      setIsPinned(false);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && canSubmit) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

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
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Add Note
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add a note to this quote
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
                  Write a note about this quote (internal only)
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
              id="pin-note"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50"
            />
            <label
              htmlFor="pin-note"
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              Pin this note to the top
            </label>
          </div>
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
            {loading ? 'Creating...' : 'Create Note'}
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

export default CreateNoteModal;
