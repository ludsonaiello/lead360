/**
 * Quote Notes List Component
 * Main notes interface for the Notes tab
 * Displays all notes with create/edit/delete functionality
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { NoteCard } from './NoteCard';
import { CreateNoteModal } from './CreateNoteModal';
import { EditNoteModal } from './EditNoteModal';
import { getQuoteNotes, deleteQuoteNote, togglePinNote } from '@/lib/api/quote-notes';
import type { QuoteNote } from '@/lib/types/quotes';
import { useRBAC } from '@/contexts/RBACContext';
import toast from 'react-hot-toast';

interface QuoteNotesListProps {
  quoteId: string;
}

export function QuoteNotesList({ quoteId }: QuoteNotesListProps) {
  const { canPerform } = useRBAC();
  const canEditNotes = canPerform('quotes', 'edit');

  const [notes, setNotes] = useState<QuoteNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<QuoteNote | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [quoteId]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await getQuoteNotes(quoteId);
      setNotes(response.notes);
      setTotal(response.total);
    } catch (error: any) {
      console.error('Failed to fetch notes:', error);
      toast.error('Could not load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    try {
      await togglePinNote(quoteId, noteId, isPinned);
      toast.success(isPinned ? 'Note pinned' : 'Note unpinned');
      fetchNotes();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update note';
      toast.error(message);
    }
  };

  const handleEditClick = (note: QuoteNote) => {
    setSelectedNote(note);
    setShowEditModal(true);
  };

  const handleDeleteClick = (note: QuoteNote) => {
    setSelectedNote(note);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedNote) return;

    setDeleting(true);
    try {
      await deleteQuoteNote(quoteId, selectedNote.id);
      toast.success('Note deleted successfully');
      setShowDeleteModal(false);
      setSelectedNote(null);
      fetchNotes();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete note';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // Separate pinned and unpinned notes
  const pinnedNotes = notes.filter((note) => note.is_pinned);
  const unpinnedNotes = notes.filter((note) => !note.is_pinned);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Notes
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {total} note{total !== 1 ? 's' : ''}
          </p>
        </div>
        {canEditNotes && (
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Note
          </Button>
        )}
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12 px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
            <MessageSquare className="w-8 h-8 text-gray-400 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No notes yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
            Add notes to keep track of important information about this quote. Notes are internal and not visible to customers.
          </p>
          {canEditNotes && (
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add your first note
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Notes Section */}
          {pinnedNotes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  Pinned
                </div>
                <div className="flex-1 h-px bg-blue-200 dark:bg-blue-800"></div>
              </div>
              <div className="space-y-3">
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isPinned={true}
                    canEdit={canEditNotes}
                    onTogglePin={handleTogglePin}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Notes Section */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Notes
                  </div>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                </div>
              )}
              <div className="space-y-3">
                {unpinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isPinned={false}
                    canEdit={canEditNotes}
                    onTogglePin={handleTogglePin}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateNoteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        quoteId={quoteId}
        onCreated={fetchNotes}
      />

      <EditNoteModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedNote(null);
        }}
        quoteId={quoteId}
        note={selectedNote}
        onUpdated={fetchNotes}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedNote(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDeleting={deleting}
      />
    </div>
  );
}

export default QuoteNotesList;
