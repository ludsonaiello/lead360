'use client';

import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import ErrorModal from '@/components/ui/ErrorModal';
import TagSelector from './TagSelector';
import { getQuoteTags, assignTagsToQuote, removeTagFromQuote } from '@/lib/api/quote-tags';
import type { QuoteTag } from '@/lib/types/quotes';

interface TagAssignmentProps {
  quoteId: string;
  initialTags?: QuoteTag[];
}

export default function TagAssignment({ quoteId, initialTags = [] }: TagAssignmentProps) {
  const [tags, setTags] = useState<QuoteTag[]>(initialTags);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<QuoteTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (initialTags.length === 0) {
      loadTags();
    }
  }, [quoteId]);

  const loadTags = async () => {
    try {
      const quoteTags = await getQuoteTags(quoteId);
      setTags(quoteTags);
    } catch (error) {
      console.error('Failed to load quote tags:', error);
    }
  };

  const handleOpenModal = () => {
    setSelectedTags([...tags]);
    setModalOpen(true);
  };

  const handleSaveTags = async () => {
    setLoading(true);
    try {
      const tagIds = selectedTags.map((t) => t.id);
      const updatedTags = await assignTagsToQuote(quoteId, { tag_ids: tagIds });
      setTags(updatedTags);
      setModalOpen(false);
    } catch (error: any) {
      console.error('Assign tags error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to assign tags');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagFromQuote(quoteId, tagId);
      setTags(tags.filter((t) => t.id !== tagId));
    } catch (error: any) {
      console.error('Remove tag error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to remove tag');
      setErrorModalOpen(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Tags:
        </span>

        {tags.length === 0 ? (
          <span className="text-sm text-gray-400 dark:text-gray-500">
            No tags assigned
          </span>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium group"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                border: `1px solid ${tag.color}`,
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tag.color }}
              ></div>
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-full p-0.5 transition-opacity"
                aria-label={`Remove ${tag.name} tag`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={handleOpenModal}
        >
          <Plus className="w-4 h-4" />
          {tags.length === 0 ? 'Add Tags' : 'Manage Tags'}
        </Button>
      </div>

      {/* Tag Management Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Manage Quote Tags"
      >
        <ModalContent>
          <TagSelector
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
          />
        </ModalContent>

        <ModalActions>
          <Button
            variant="secondary"
            onClick={() => setModalOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveTags}
            loading={loading}
          >
            Save Tags
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        message={errorMessage}
      />
    </>
  );
}
