'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import ErrorModal from '@/components/ui/ErrorModal';
import TagFormModal from '@/components/quotes/tags/TagFormModal';
import { getTags, deleteTag } from '@/lib/api/quote-tags';
import type { QuoteTag } from '@/lib/types/quotes';

export default function TagsManagementPage() {
  const [tags, setTags] = useState<QuoteTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<QuoteTag | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<QuoteTag | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setLoading(true);
    try {
      const response = await getTags({ include_inactive: true });
      setTags(response);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTag(null);
    setFormModalOpen(true);
  };

  const handleEdit = (tag: QuoteTag) => {
    setEditingTag(tag);
    setFormModalOpen(true);
  };

  const handleDelete = (tag: QuoteTag) => {
    setTagToDelete(tag);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!tagToDelete) return;

    try {
      await deleteTag(tagToDelete.id);
      setTags(tags.filter((t) => t.id !== tagToDelete.id));
      setDeleteModalOpen(false);
      setTagToDelete(null);
    } catch (error: any) {
      console.error('Delete tag error:', error);
      const message = error.response?.data?.message || 'Failed to delete tag';

      if (message.includes('usage_count') || message.includes('in use')) {
        setErrorMessage(
          `Cannot delete tag "${tagToDelete.name}" because it is currently in use on ${tagToDelete.usage_count} quote(s). Mark it as inactive instead.`
        );
      } else {
        setErrorMessage(message);
      }
      setDeleteModalOpen(false);
      setTagToDelete(null);
      setErrorModalOpen(true);
    }
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setEditingTag(null);
    loadTags();
  };

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Quote Tags
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Organize and categorize your quotes with custom tags
            </p>
          </div>
          <Button variant="primary" onClick={handleCreate}>
            <Plus className="w-4 h-4" />
            Create Tag
          </Button>
        </div>

        {/* Search */}
        <Card className="p-4">
          <Input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-5 h-5" />}
          />
        </Card>

        {/* Tags Grid */}
        {filteredTags.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4"
              >
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No tags found' : 'No tags yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Create your first tag to start organizing quotes'}
              </p>
              {!searchQuery && (
                <Button variant="primary" onClick={handleCreate}>
                  <Plus className="w-4 h-4" />
                  Create Tag
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTags.map((tag) => (
              <Card key={tag.id} className="p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
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
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Color:</span>
                    <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {tag.color}
                    </code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <Badge variant={tag.is_active ? 'success' : 'neutral'}>
                      {tag.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Usage:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {tag.usage_count} {tag.usage_count === 1 ? 'quote' : 'quotes'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEdit(tag)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(tag)}
                    disabled={tag.usage_count > 0}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Tag Form Modal */}
      <TagFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingTag(null);
        }}
        onSuccess={handleFormSuccess}
        tag={editingTag}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Tag"
        message={`Are you sure you want to delete the tag "${tagToDelete?.name}"? This action cannot be undone.`}
      />

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
