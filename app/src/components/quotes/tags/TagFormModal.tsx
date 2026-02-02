'use client';

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ColorPicker from '@/components/ui/ColorPicker';
import { createTag, updateTag } from '@/lib/api/quote-tags';
import type { QuoteTag } from '@/lib/types/quotes';

interface TagFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  tag?: QuoteTag | null;
}

const TAG_COLOR_PRESETS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Gray', value: '#6b7280' },
];

export default function TagFormModal({
  isOpen,
  onClose,
  onSuccess,
  tag,
}: TagFormModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!tag;

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setColor(tag.color);
      setIsActive(tag.is_active);
    } else {
      setName('');
      setColor('#3b82f6');
      setIsActive(true);
    }
    setError(null);
  }, [tag, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate hex color format
      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        setError('Color must be in hex format (#RRGGBB)');
        setLoading(false);
        return;
      }

      if (isEditing && tag) {
        await updateTag(tag.id, {
          name: name.trim(),
          color,
          is_active: isActive,
        });
      } else {
        await createTag({
          name: name.trim(),
          color,
        });
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('Tag form error:', err);
      setError(err.response?.data?.message || 'Failed to save tag');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Tag' : 'Create Tag'}
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Tag Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tag Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., High Priority, VIP Customer"
                maxLength={100}
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {name.length}/100 characters
              </p>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color <span className="text-red-500">*</span>
              </label>
              <ColorPicker
                value={color}
                onChange={setColor}
                presets={TAG_COLOR_PRESETS.map(p => p.value)}
              />
            </div>

            {/* Color Preview */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: `${color}20`,
                  color: color,
                  border: `1px solid ${color}`,
                }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                ></div>
                {name || 'Tag Name'}
              </div>
            </div>

            {/* Active Toggle (only for editing) */}
            {isEditing && (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Active Status
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Inactive tags won't appear in tag selection
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Usage Warning (for editing) */}
            {isEditing && tag && tag.usage_count > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This tag is currently used on {tag.usage_count}{' '}
                  {tag.usage_count === 1 ? 'quote' : 'quotes'}. Changes will affect all tagged quotes.
                </p>
              </div>
            )}
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!name.trim() || !color}
          >
            {!loading && <Save className="w-4 h-4" />}
            {isEditing ? 'Save Changes' : 'Create Tag'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
