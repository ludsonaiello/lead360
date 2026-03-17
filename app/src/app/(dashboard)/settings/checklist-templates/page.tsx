/**
 * Checklist Template Settings Page
 * CRUD for completion checklist templates with sortable items.
 * Role-gated: Owner, Admin
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ClipboardCheck,
  X,
  Asterisk,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { SortableList } from '@/components/ui/SortableList';
import { SortableItem } from '@/components/ui/SortableItem';
import { useRBAC } from '@/contexts/RBACContext';
import {
  listAllChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
} from '@/lib/api/projects';
import type {
  ChecklistTemplate,
  CreateChecklistTemplateItemDto,
} from '@/lib/types/projects';

// ============================================================================
// Types
// ============================================================================

interface EditableItem {
  _key: string; // client-side key for drag
  title: string;
  description: string;
  is_required: boolean;
}

// ============================================================================
// Main Page
// ============================================================================

export default function ChecklistTemplatesPage() {
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAllChecklistTemplates({ limit: 100 });
      setTemplates(res.data);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Permission check — after all hooks
  if (rbacLoading) return null;
  if (!hasPermission('settings:edit')) {
    router.push('/forbidden');
    return null;
  }

  const handleToggleActive = async (template: ChecklistTemplate) => {
    setTogglingId(template.id);
    try {
      const updated = await updateChecklistTemplate(template.id, {
        is_active: !template.is_active,
      });
      setTemplates((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
      toast.success(`Template ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update template');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteChecklistTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = (saved: ChecklistTemplate) => {
    if (editingTemplate) {
      setTemplates((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    } else {
      setTemplates((prev) => [saved, ...prev]);
    }
    setShowForm(false);
    setEditingTemplate(null);
  };

  const openEdit = (template: ChecklistTemplate) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Checklist Templates
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Define reusable completion checklist templates for your projects
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner size="lg" centered />
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
            No Templates Yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create your first checklist template to streamline project completion.
          </p>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Create Template
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {template.name}
                    </h3>
                    <Badge variant={template.is_active ? 'success' : 'neutral'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {template.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {template.items.length} item{template.items.length !== 1 ? 's' : ''}
                    {' · '}
                    {template.items.filter((i) => i.is_required).length} required
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <ToggleSwitch
                    enabled={template.is_active}
                    onChange={() => handleToggleActive(template)}
                    disabled={togglingId === template.id}
                  />
                  <button
                    onClick={() => openEdit(template)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(template)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <TemplateFormModal
          template={editingTemplate}
          onSaved={handleSaved}
          onClose={() => { setShowForm(false); setEditingTemplate(null); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
          <ModalContent title="Delete Template">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              This will permanently remove the template and all its items. This action cannot be undone.
            </p>
          </ModalContent>
          <ModalActions>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete Template
            </Button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// Template Form Modal (Create / Edit)
// ============================================================================

function TemplateFormModal({
  template,
  onSaved,
  onClose,
}: {
  template: ChecklistTemplate | null;
  onSaved: (t: ChecklistTemplate) => void;
  onClose: () => void;
}) {
  const isEditing = !!template;
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [items, setItems] = useState<EditableItem[]>(() => {
    if (template?.items) {
      return template.items
        .sort((a, b) => a.order_index - b.order_index)
        .map((item, idx) => ({
          _key: `existing-${idx}`,
          title: item.title,
          description: item.description || '',
          is_required: item.is_required,
        }));
    }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const keyCounter = useRef(0);

  const addItem = () => {
    keyCounter.current += 1;
    setItems((prev) => [
      ...prev,
      { _key: `new-${keyCounter.current}`, title: '', description: '', is_required: true },
    ]);
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i._key !== key));
  };

  const updateItem = (key: string, field: keyof EditableItem, value: string | boolean) => {
    setItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, [field]: value } : i)),
    );
  };

  const handleReorder = (reordered: EditableItem[]) => {
    setItems(reordered);
  };

  const handleSubmit = async () => {
    setError('');

    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    // Filter out empty items
    const validItems = items.filter((i) => i.title.trim());
    if (validItems.length === 0) {
      setError('Add at least one checklist item');
      return;
    }

    const itemDtos: CreateChecklistTemplateItemDto[] = validItems.map((item, idx) => ({
      title: item.title.trim(),
      description: item.description.trim() || undefined,
      is_required: item.is_required,
      order_index: idx,
    }));

    setSaving(true);
    try {
      let saved: ChecklistTemplate;
      if (isEditing && template) {
        saved = await updateChecklistTemplate(template.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          items: itemDtos,
        });
        toast.success('Template updated');
      } else {
        saved = await createChecklistTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          items: itemDtos,
        });
        toast.success('Template created');
      }
      onSaved(saved);
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 409) {
        setError('A template with this name already exists');
      } else {
        setError(apiErr.message || 'Failed to save template');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalContent title={isEditing ? 'Edit Template' : 'Create Template'}>
        <div className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <Input
            label="Template Name"
            placeholder="e.g., Standard Roofing Completion"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Textarea
            label="Description"
            placeholder="Optional description for this template"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                Checklist Items
              </label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  No items yet. Click &quot;Add Item&quot; to get started.
                </p>
              </div>
            ) : (
              <SortableList
                items={items}
                onReorder={handleReorder}
                getItemId={(item) => item._key}
              >
                {(item) => (
                  <SortableItem id={item._key} key={item._key}>
                    <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mb-2">
                      <div className="mt-2.5 cursor-grab text-gray-400 dark:text-gray-500 flex-shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <Input
                          placeholder="Item title"
                          value={item.title}
                          onChange={(e) => updateItem(item._key, 'title', e.target.value)}
                        />
                        <Input
                          placeholder="Description (optional)"
                          value={item.description}
                          onChange={(e) => updateItem(item._key, 'description', e.target.value)}
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <input
                            type="checkbox"
                            checked={item.is_required}
                            onChange={(e) => updateItem(item._key, 'is_required', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Required for completion
                          {item.is_required && <Asterisk className="w-3 h-3 text-red-400" />}
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item._key)}
                        className="mt-2.5 p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        title="Remove item"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </SortableItem>
                )}
              </SortableList>
            )}
          </div>
        </div>
      </ModalContent>
      <ModalActions>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={saving}>
          {isEditing ? 'Save Changes' : 'Create Template'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
