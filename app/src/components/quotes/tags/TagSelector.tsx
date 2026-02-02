'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Search } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ErrorModal from '@/components/ui/ErrorModal';
import { getTags, createTag } from '@/lib/api/quote-tags';
import type { QuoteTag, CreateQuoteTagDto } from '@/lib/types/quotes';

interface TagSelectorProps {
  selectedTags: QuoteTag[];
  onTagsChange: (tags: QuoteTag[]) => void;
}

const TAG_COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#6b7280',
];

export default function TagSelector({ selectedTags, onTagsChange }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<QuoteTag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const tags = await getTags({ include_inactive: false });
      setAllTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleAddTag = (tag: QuoteTag) => {
    if (!selectedTags.find((t) => t.id === tag.id)) {
      onTagsChange([...selectedTags, tag]);
    }
    setSearchQuery('');
  };

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(selectedTags.filter((t) => t.id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setLoading(true);
    try {
      const dto: CreateQuoteTagDto = {
        name: newTagName.trim(),
        color: newTagColor,
      };
      const newTag = await createTag(dto);

      // Add to all tags and selected tags
      setAllTags([...allTags, newTag]);
      onTagsChange([...selectedTags, newTag]);

      // Reset form
      setNewTagName('');
      setNewTagColor(TAG_COLOR_PRESETS[0]);
      setShowCreateForm(false);
      setSearchQuery('');
    } catch (error: any) {
      console.error('Create tag error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to create tag');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Filter available tags (exclude already selected)
  const selectedTagIds = new Set(selectedTags.map((t) => t.id));
  const availableTags = allTags.filter(
    (tag) =>
      !selectedTagIds.has(tag.id) &&
      tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <div
              key={tag.id}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
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
                className="ml-1 hover:opacity-70"
                aria-label={`Remove ${tag.name} tag`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search/Add Tags */}
      <div>
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tags..."
          leftIcon={<Search className="w-5 h-5" />}
        />

        {/* Available Tags Dropdown */}
        {searchQuery && (
          <div className="mt-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
            {availableTags.length > 0 ? (
              <div className="p-2 space-y-1">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    ></div>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {tag.name}
                    </span>
                    <span className="ml-auto text-xs text-gray-500">
                      {tag.usage_count} uses
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  No tags found
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="w-4 h-4" />
                  Create New Tag
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create New Tag Form */}
      {showCreateForm && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Create New Tag
          </h4>
          <div className="space-y-3">
            <Input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              maxLength={100}
              autoFocus
            />

            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      newTagColor === color ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select ${color} color`}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 mb-2">Preview:</p>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: `${newTagColor}20`,
                  color: newTagColor,
                  border: `1px solid ${newTagColor}`,
                }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: newTagColor }}
                ></div>
                {newTagName || 'Tag Name'}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateTag}
                loading={loading}
                disabled={!newTagName.trim()}
              >
                Create & Add
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTagName('');
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        message={errorMessage}
      />
    </div>
  );
}
