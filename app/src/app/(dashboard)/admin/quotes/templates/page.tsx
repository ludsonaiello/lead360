/**
 * Quote Template Builder - Main Gallery & Library Page
 * Comprehensive template management with visual and code templates
 * Features: Filters, search, preview, clone, version history, testing
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Eye,
  Code,
  Palette,
  Copy,
  Trash2,
  FileText,
  Star,
  Settings,
  Download,
  Upload,
  Layers,
  Grid3x3,
  List,
  Filter,
  X,
  Check,
  AlertTriangle,
  TrendingUp,
  Clock,
  Mail,
  Box,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { toast } from 'react-hot-toast';
import {
  listBuilderTemplates,
  deleteBuilderTemplate,
  cloneBuilderTemplate,
  setTemplateAsDefault,
  getMigrationStats,
} from '@/lib/api/template-builder';
import type {
  BuilderTemplate,
  TemplateType,
  MigrationStatsResponse,
} from '@/lib/types/quote-admin';
import TemplatePreviewModal from '@/components/templates/TemplatePreviewModal';

type ViewMode = 'grid' | 'list';
type FilterTab = 'all' | 'visual' | 'code' | 'prebuilt' | 'global' | 'custom';

export default function TemplateBuilderPage() {
  const router = useRouter();

  // State for templates
  const [templates, setTemplates] = useState<BuilderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 12;

  // Migration stats
  const [migrationStats, setMigrationStats] = useState<MigrationStatsResponse | null>(null);

  // Modal states
  const [selectedTemplate, setSelectedTemplate] = useState<BuilderTemplate | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<{ id: string; name: string } | null>(null);

  // Load templates
  useEffect(() => {
    loadTemplates();
    loadMigrationStats();
  }, [page, activeFilter, showActiveOnly, searchQuery, selectedTags]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const filters: any = {
        page,
        limit,
      };

      if (showActiveOnly) filters.is_active = true;
      if (searchQuery) filters.search = searchQuery;
      if (selectedTags.length > 0) filters.tags = selectedTags;

      // Apply filter tabs
      if (activeFilter === 'visual') filters.template_type = 'visual';
      if (activeFilter === 'code') filters.template_type = 'code';
      if (activeFilter === 'global') filters.is_global = true;
      if (activeFilter === 'custom') filters.is_global = false;

      const result = await listBuilderTemplates(filters);
      setTemplates(result.data);
      setTotalPages(result.pagination.total);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load templates');
      console.error('[TEMPLATES] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMigrationStats = async () => {
    try {
      const stats = await getMigrationStats();
      setMigrationStats(stats);
    } catch (error) {
      console.error('[TEMPLATES] Failed to load migration stats:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    try {
      setActionLoading(true);
      await deleteBuilderTemplate(selectedTemplate.id);
      toast.success('Template deleted successfully');
      setDeleteModalOpen(false);
      setSelectedTemplate(null);
      loadTemplates();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete template');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClone = async () => {
    if (!selectedTemplate || !cloneName.trim()) {
      toast.error('Please enter a name for the cloned template');
      return;
    }

    try {
      setActionLoading(true);
      const cloned = await cloneBuilderTemplate(selectedTemplate.id, { new_name: cloneName });
      toast.success('Template cloned successfully');
      setCloneModalOpen(false);
      setSelectedTemplate(null);
      setCloneName('');

      // Navigate to edit the cloned template
      if (cloned.template_type === 'visual') {
        router.push(`/admin/quotes/templates/builder/${cloned.id}`);
      } else {
        router.push(`/admin/quotes/templates/code-editor/${cloned.id}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to clone template');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetAsDefault = async (templateId: string) => {
    try {
      await setTemplateAsDefault(templateId);
      toast.success('Template set as default successfully');
      loadTemplates();
    } catch (error: any) {
      toast.error(error.message || 'Failed to set template as default');
    }
  };

  const openCloneModal = (template: BuilderTemplate) => {
    setSelectedTemplate(template);
    setCloneName(`${template.name} (Copy)`);
    setCloneModalOpen(true);
  };

  const openDeleteModal = (template: BuilderTemplate) => {
    setSelectedTemplate(template);
    setDeleteModalOpen(true);
  };

  const openDetailsModal = (template: BuilderTemplate) => {
    setSelectedTemplate(template);
    setDetailsModalOpen(true);
  };

  const handleCreateNew = (type: TemplateType) => {
    if (type === 'visual') {
      router.push('/admin/quotes/templates/builder/new');
    } else {
      router.push('/admin/quotes/templates/code-editor/new');
    }
  };

  const availableTags = Array.from(
    new Set(
      templates.flatMap((t) => t.tags || [])
    )
  ).sort();

  const filterTabs: Array<{ id: FilterTab; label: string; icon: any }> = [
    { id: 'all', label: 'All Templates', icon: Grid3x3 },
    { id: 'visual', label: 'Visual', icon: Palette },
    { id: 'code', label: 'Code', icon: Code },
    { id: 'prebuilt', label: 'Pre-built', icon: Box },
    { id: 'global', label: 'Global', icon: TrendingUp },
    { id: 'custom', label: 'Custom', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Quote Template Builder</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage professional quote templates with visual and code editors
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => router.push('/admin/quotes/templates/components')}
          >
            <Layers className="w-4 h-4" />
            Component Library
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push('/admin/quotes/templates/prebuilt')}
          >
            <Box className="w-4 h-4" />
            Pre-built Gallery
          </Button>
          <div className="relative group">
            <Button variant="primary">
              <Plus className="w-4 h-4" />
              Create Template
            </Button>
            {/* Dropdown menu for create options */}
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleCreateNew('visual')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg flex items-center gap-3"
              >
                <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Visual Template</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Drag-and-drop builder</div>
                </div>
              </button>
              <button
                onClick={() => handleCreateNew('code')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-lg flex items-center gap-3"
              >
                <Code className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Code Template</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">HTML/CSS with Handlebars</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Migration Stats Banner (if needed) */}
      {migrationStats && migrationStats.pending_migration > 0 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-800">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Template Migration Available
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {migrationStats.pending_migration} legacy templates need migration to the new builder system
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/admin/quotes/templates/migration')}
            >
              <Upload className="w-4 h-4" />
              Migrate Now
            </Button>
          </div>
        </Card>
      )}

      {/* Filters & Search Bar */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* Search & View Toggle */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search templates by name, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                rightIcon={
                  searchQuery ? (
                    <button onClick={() => setSearchQuery('')}>
                      <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  ) : undefined
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Active only</span>
                <ToggleSwitch
                  enabled={showActiveOnly}
                  onChange={setShowActiveOnly}
                />
              </div>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all
                    ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tag Filters */}
          {availableTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Tags:
              </span>
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTags(selectedTags.filter((t) => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    className={`
                      px-3 py-1 rounded-full text-xs font-medium transition-all
                      ${
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {tag}
                    {isSelected && <Check className="w-3 h-3 inline ml-1" />}
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Templates Grid/List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No templates found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery || selectedTags.length > 0
                ? 'Try adjusting your filters or search query'
                : 'Get started by creating your first template'}
            </p>
            {!searchQuery && selectedTags.length === 0 && (
              <div className="flex items-center justify-center gap-3">
                <Button onClick={() => handleCreateNew('visual')}>
                  <Palette className="w-4 h-4" />
                  Create Visual Template
                </Button>
                <Button variant="secondary" onClick={() => handleCreateNew('code')}>
                  <Code className="w-4 h-4" />
                  Create Code Template
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onClone={() => openCloneModal(template)}
              onDelete={() => openDeleteModal(template)}
              onView={() => setPreviewTemplate({ id: template.id, name: template.name })}
              onEdit={() => {
                if (template.template_type === 'visual') {
                  router.push(`/admin/quotes/templates/builder/${template.id}`);
                } else {
                  router.push(`/admin/quotes/templates/code-editor/${template.id}`);
                }
              }}
              onSetDefault={() => handleSetAsDefault(template.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {templates.map((template) => (
                  <TemplateRow
                    key={template.id}
                    template={template}
                    onClone={() => openCloneModal(template)}
                    onDelete={() => openDeleteModal(template)}
                    onView={() => setPreviewTemplate({ id: template.id, name: template.name })}
                    onEdit={() => {
                      if (template.template_type === 'visual') {
                        router.push(`/admin/quotes/templates/builder/${template.id}`);
                      } else {
                        router.push(`/admin/quotes/templates/code-editor/${template.id}`);
                      }
                    }}
                    onSetDefault={() => handleSetAsDefault(template.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Clone Modal */}
      <Modal
        isOpen={cloneModalOpen}
        onClose={() => !actionLoading && setCloneModalOpen(false)}
        title="Clone Template"
      >
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Create a copy of <strong>{selectedTemplate?.name}</strong>
            </p>
            <Input
              label="New Template Name"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Enter template name"
              required
            />
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setCloneModalOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleClone} loading={actionLoading}>
            Clone Template
          </Button>
        </ModalActions>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !actionLoading && setDeleteModalOpen(false)}
        title="Delete Template"
      >
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>{selectedTemplate?.name}</strong>?
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            This action cannot be undone. All version history will also be deleted.
          </p>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={actionLoading}>
            Delete Template
          </Button>
        </ModalActions>
      </Modal>

      {/* Details Modal */}
      {selectedTemplate && (
        <TemplateDetailsModal
          template={selectedTemplate}
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
        />
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          isOpen={true}
          onClose={() => setPreviewTemplate(null)}
          templateId={previewTemplate.id}
          templateName={previewTemplate.name}
        />
      )}
    </div>
  );
}

// Template Card Component (Grid View)
function TemplateCard({
  template,
  onClone,
  onDelete,
  onView,
  onEdit,
  onSetDefault,
}: {
  template: BuilderTemplate;
  onClone: () => void;
  onDelete: () => void;
  onView: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  const TypeIcon = template.template_type === 'visual' ? Palette : Code;

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
      {/* Thumbnail/Preview */}
      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 relative overflow-hidden">
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <TypeIcon className="w-16 h-16 text-gray-400 dark:text-gray-600" />
          </div>
        )}

        {/* Overlay on Hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={onView}
            className="p-3 bg-white/90 rounded-lg hover:bg-white transition-colors"
            title="View details"
          >
            <Eye className="w-5 h-5 text-gray-900" />
          </button>
          <button
            onClick={onEdit}
            className="p-3 bg-white/90 rounded-lg hover:bg-white transition-colors"
            title="Edit template"
          >
            <Settings className="w-5 h-5 text-gray-900" />
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-2">
          {template.is_default && (
            <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" />
              Default
            </span>
          )}
          {template.is_global && (
            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
              Global
            </span>
          )}
          {template.is_prebuilt && (
            <span className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
              Pre-built
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
              {template.name}
            </h3>
            <TypeIcon className={`w-5 h-5 flex-shrink-0 ${
              template.template_type === 'visual'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-purple-600 dark:text-purple-400'
            }`} />
          </div>
          {template.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
              {template.description}
            </p>
          )}
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded">
                +{template.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(template.updated_at).toLocaleDateString()}
          </span>
          <span className={`px-2 py-1 rounded-full ${
            template.is_active
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            {template.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClone}
            className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <Copy className="w-4 h-4 inline mr-1" />
            Clone
          </button>
          {!template.is_default && template.is_global && (
            <button
              onClick={onSetDefault}
              className="flex-1 px-3 py-2 text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
              title="Set as platform default"
            >
              <Star className="w-4 h-4 inline mr-1" />
              Default
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Delete template"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}

// Template Row Component (List View)
function TemplateRow({
  template,
  onClone,
  onDelete,
  onView,
  onEdit,
  onSetDefault,
}: {
  template: BuilderTemplate;
  onClone: () => void;
  onDelete: () => void;
  onView: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  const TypeIcon = template.template_type === 'visual' ? Palette : Code;

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            template.template_type === 'visual'
              ? 'bg-blue-100 dark:bg-blue-900/30'
              : 'bg-purple-100 dark:bg-purple-900/30'
          }`}>
            <TypeIcon className={`w-5 h-5 ${
              template.template_type === 'visual'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-purple-600 dark:text-purple-400'
            }`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-gray-900 dark:text-white truncate">
                {template.name}
              </div>
              {template.is_default && (
                <Star className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />
              )}
              {template.is_global && (
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded flex-shrink-0">
                  Global
                </span>
              )}
            </div>
            {template.description && (
              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {template.description}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="capitalize text-sm text-gray-700 dark:text-gray-300">
          {template.template_type}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          template.is_active
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`}>
          {template.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
        {new Date(template.updated_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onView}
            className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
            title="Edit template"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onClone}
            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
            title="Clone template"
          >
            <Copy className="w-4 h-4" />
          </button>
          {!template.is_default && template.is_global && (
            <button
              onClick={onSetDefault}
              className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg"
              title="Set as default"
            >
              <Star className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
            title="Delete template"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Template Details Modal Component
function TemplateDetailsModal({
  template,
  isOpen,
  onClose,
}: {
  template: BuilderTemplate;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const TypeIcon = template.template_type === 'visual' ? Palette : Code;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Template Details"
      size="lg"
    >
      <ModalContent>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${
              template.template_type === 'visual'
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : 'bg-purple-100 dark:bg-purple-900/30'
            }`}>
              <TypeIcon className={`w-8 h-8 ${
                template.template_type === 'visual'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-purple-600 dark:text-purple-400'
              }`} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{template.name}</h3>
              {template.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">{template.description}</p>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</div>
              <div className="mt-1 capitalize">{template.template_type}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
              <div className="mt-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  template.is_active
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</div>
              <div className="mt-1">{new Date(template.created_at).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</div>
              <div className="mt-1">{new Date(template.updated_at).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</div>
              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Flags */}
          <div className="flex flex-wrap gap-3">
            {template.is_default && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-400 fill-current" />
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  Platform Default
                </span>
              </div>
            )}
            {template.is_global && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Global Template
                </span>
              </div>
            )}
            {template.is_prebuilt && (
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Box className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Pre-built Template
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="primary"
              onClick={() => {
                if (template.template_type === 'visual') {
                  router.push(`/admin/quotes/templates/builder/${template.id}`);
                } else {
                  router.push(`/admin/quotes/templates/code-editor/${template.id}`);
                }
              }}
            >
              <Settings className="w-4 h-4" />
              Edit Template
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(`/admin/quotes/templates/preview/${template.id}`)}
            >
              <Eye className="w-4 h-4" />
              Preview & Test
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(`/admin/quotes/templates/versions/${template.id}`)}
            >
              <Clock className="w-4 h-4" />
              Version History
            </Button>
          </div>
        </div>
      </ModalContent>
      <ModalActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}
