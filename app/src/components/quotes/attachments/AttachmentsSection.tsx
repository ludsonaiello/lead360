/**
 * Attachments Section Component
 * Main container for quote attachments with drag-and-drop reordering
 * Displays all attachments grouped by type
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Paperclip, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { QuoteAttachment } from '@/lib/types/quotes';
import {
  listAttachments,
  deleteAttachment,
  reorderAttachments,
} from '@/lib/api/quote-attachments';
import { AttachmentCard } from './AttachmentCard';
import { AddAttachmentModal } from './AddAttachmentModal';
import { EditAttachmentModal } from './EditAttachmentModal';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';

interface AttachmentsSectionProps {
  quoteId: string;
  className?: string;
  readOnly?: boolean;
}

// Sortable wrapper for AttachmentCard
function SortableAttachmentCard({
  attachment,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  attachment: QuoteAttachment;
  onEdit: (attachment: QuoteAttachment) => void;
  onDelete: (attachment: QuoteAttachment) => void;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: attachment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <AttachmentCard
        attachment={attachment}
        onEdit={onEdit}
        onDelete={onDelete}
        draggable={!readOnly}
        dragHandleProps={readOnly ? undefined : { ...attributes, ...listeners }}
        readOnly={readOnly}
      />
    </div>
  );
}

export function AttachmentsSection({ quoteId, className = '', readOnly = false }: AttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<QuoteAttachment | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadAttachments = async () => {
    try {
      const data = await listAttachments(quoteId);
      setAttachments(data);
    } catch (error: any) {
      toast.error('Failed to load attachments');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttachments();
  }, [quoteId]);

  const handleEdit = (attachment: QuoteAttachment) => {
    setSelectedAttachment(attachment);
    setShowEditModal(true);
  };

  const handleDelete = (attachment: QuoteAttachment) => {
    setSelectedAttachment(attachment);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedAttachment) return;

    setIsDeleting(true);
    try {
      await deleteAttachment(quoteId, selectedAttachment.id);
      toast.success('Attachment deleted successfully');
      setShowDeleteModal(false);
      setSelectedAttachment(null);
      loadAttachments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete attachment');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = attachments.findIndex((a) => a.id === active.id);
    const newIndex = attachments.findIndex((a) => a.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newAttachments = arrayMove(attachments, oldIndex, newIndex);

    // Update local state immediately for smooth UX
    setAttachments(newAttachments);

    // Send reorder request to backend
    try {
      const reorderData = {
        attachments: newAttachments.map((att, index) => ({
          id: att.id,
          order_index: index,
        })),
      };

      await reorderAttachments(quoteId, reorderData);
      toast.success('Attachments reordered');
    } catch (error: any) {
      toast.error('Failed to save new order');
      // Reload to get correct order from server
      loadAttachments();
    }
  };

  if (isLoading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={`p-6 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Paperclip className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Attachments
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {readOnly ? 'Quote attachments (view-only)' : 'Add photos, links, and QR codes to your quote'}
              </p>
            </div>
          </div>
          {!readOnly && (
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Attachment
            </Button>
          )}
        </div>

        {/* Attachments List */}
        {attachments.length === 0 ? (
          <div className="text-center py-12">
            <Paperclip className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No attachments yet
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {readOnly ? 'This quote has no attachments.' : 'Add photos, URLs with QR codes, or grid layouts to enhance your quote'}
            </p>
            {!readOnly && (
              <Button variant="primary" onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Attachment
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Drag-and-Drop Info */}
            {!readOnly && (
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Drag attachments to reorder them. They will appear in this order in the
                    PDF.
                  </p>
                </div>
              </div>
            )}

            {/* Sortable List */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={attachments.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {attachments.map((attachment) => (
                    <SortableAttachmentCard
                      key={attachment.id}
                      attachment={attachment}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </Card>

      {/* Modals */}
      <AddAttachmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        quoteId={quoteId}
        onSuccess={loadAttachments}
      />

      {showEditModal && selectedAttachment && (
        <EditAttachmentModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAttachment(null);
          }}
          attachment={selectedAttachment}
          quoteId={quoteId}
          onSuccess={loadAttachments}
        />
      )}

      {showDeleteModal && selectedAttachment && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            if (!isDeleting) {
              setShowDeleteModal(false);
              setSelectedAttachment(null);
            }
          }}
          onConfirm={confirmDelete}
          title="Delete Attachment"
          message={`Are you sure you want to delete this ${selectedAttachment.attachment_type.replace('_', ' ')}? ${selectedAttachment.title ? `"${selectedAttachment.title}"` : ''} This action cannot be undone and will permanently remove the attachment and its associated files.`}
          confirmText="Delete Attachment"
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}

export default AttachmentsSection;
