/**
 * NotesList Component
 * Display and manage lead notes with pinning
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Pin, Edit, Trash2, Save, X, Loader2 } from 'lucide-react';
import type { LeadNote } from '@/lib/types/leads';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatDistanceToNow } from 'date-fns';
import { getNotes, addNote, updateNote, deleteNote } from '@/lib/api/leads';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

interface NotesListProps {
  leadId: string;
  canEdit: boolean;
  className?: string;
}

export function NotesList({ leadId, canEdit, className = '' }: NotesListProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadNotes();
  }, [leadId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const response = await getNotes(leadId);
      setNotes(response.data);
    } catch (error: any) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Separate pinned and unpinned notes
  const pinnedNotes = notes.filter((n) => n.is_pinned);
  const unpinnedNotes = notes.filter((n) => !n.is_pinned);

  const handleAddNote = async () => {
    if (!newNoteText.trim()) {
      toast.error('Note text cannot be empty');
      return;
    }

    setIsSubmitting(true);
    try {
      await addNote(leadId, {
        note_text: newNoteText,
        is_pinned: false,
      });
      setNewNoteText('');
      toast.success('Note added successfully');
      await loadNotes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editText.trim()) {
      toast.error('Note text cannot be empty');
      return;
    }

    try {
      await updateNote(leadId, noteId, { note_text: editText });
      setEditingId(null);
      setEditText('');
      toast.success('Note updated successfully');
      await loadNotes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update note');
    }
  };

  const handleDeleteNote = (noteId: string) => {
    setNoteToDelete(noteId);
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;

    try {
      await deleteNote(leadId, noteToDelete);
      toast.success('Note deleted successfully');
      await loadNotes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete note');
    } finally {
      setShowConfirmDelete(false);
      setNoteToDelete(null);
    }
  };

  const handleTogglePin = async (noteId: string, currentPinned: boolean) => {
    try {
      await updateNote(leadId, noteId, { is_pinned: !currentPinned });
      toast.success(currentPinned ? 'Note unpinned' : 'Note pinned');
      await loadNotes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle pin');
    }
  };

  const startEditing = (note: LeadNote) => {
    setEditingId(note.id);
    setEditText(note.note_text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Add Note Form */}
      {canEdit && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              resize-none"
          />
          <div className="flex justify-end mt-2">
            <Button onClick={handleAddNote} disabled={isSubmitting || !newNoteText.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Note'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-500 text-sm text-center py-8">
          No notes yet
        </p>
      ) : (
        <div className="space-y-3">
          {/* Pinned Notes */}
          {pinnedNotes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase">
                Pinned
              </h3>
              {pinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isEditing={editingId === note.id}
                  editText={editText}
                  onEditTextChange={setEditText}
                  onStartEdit={() => startEditing(note)}
                  onSaveEdit={() => handleUpdateNote(note.id)}
                  onCancelEdit={cancelEditing}
                  onDelete={() => handleDeleteNote(note.id)}
                  onTogglePin={() => handleTogglePin(note.id, note.is_pinned)}
                  canEdit={canEdit && note.user_id === user?.id}
                  canPin={canEdit}
                />
              ))}
            </div>
          )}

          {/* Unpinned Notes */}
          {unpinnedNotes.length > 0 && (
            <div className="space-y-3">
              {pinnedNotes.length > 0 && (
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase">
                  Notes
                </h3>
              )}
              {unpinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isEditing={editingId === note.id}
                  editText={editText}
                  onEditTextChange={setEditText}
                  onStartEdit={() => startEditing(note)}
                  onSaveEdit={() => handleUpdateNote(note.id)}
                  onCancelEdit={cancelEditing}
                  onDelete={() => handleDeleteNote(note.id)}
                  onTogglePin={() => handleTogglePin(note.id, note.is_pinned)}
                  canEdit={canEdit && note.user_id === user?.id}
                  canPin={canEdit}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false);
          setNoteToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

interface NoteCardProps {
  note: LeadNote;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  canEdit: boolean;
  canPin: boolean;
}

function NoteCard({
  note,
  isEditing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onTogglePin,
  canEdit,
  canPin,
}: NoteCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              {note.user ? `${note.user.first_name} ${note.user.last_name}` : 'Unknown User'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
            </span>
          </div>
          {note.is_pinned && (
            <Pin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500 fill-current" />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {canPin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onTogglePin}
              title={note.is_pinned ? 'Unpin' : 'Pin'}
            >
              <Pin
                className={`w-4 h-4 ${note.is_pinned ? 'fill-current text-blue-600 dark:text-blue-500' : ''}`}
              />
            </Button>
          )}
          {canEdit && !isEditing && (
            <>
              <Button size="sm" variant="ghost" onClick={onStartEdit}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-500" />
              </Button>
            </>
          )}
          {isEditing && (
            <>
              <Button size="sm" variant="ghost" onClick={onSaveEdit}>
                <Save className="w-4 h-4 text-green-600 dark:text-green-500" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <textarea
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
            bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            resize-none"
        />
      ) : (
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {note.note_text}
        </p>
      )}
    </div>
  );
}

export default NotesList;
