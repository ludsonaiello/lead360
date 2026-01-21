/**
 * Admin Template Management Page
 * Allows platform admins to manage ALL templates (system + tenant)
 * Can edit system templates (bypasses is_system restriction)
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, Eye, Edit, Trash2, FileText, X } from 'lucide-react';
import { getTemplates, deleteTemplate, previewTemplate } from '@/lib/api/communication';
import type { EmailTemplate, GetTemplatesParams } from '@/lib/types/communication';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { TemplateTypeBadge } from '@/components/communication/TemplateTypeBadge';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Filters
  const [filters, setFilters] = useState<GetTemplatesParams>({
    page: 1,
    limit,
  });

  const [tempFilters, setTempFilters] = useState<GetTemplatesParams>({
    page: 1,
    limit,
  });

  // Filter options
  const categoryOptions: SelectOption[] = [
    { value: '', label: 'All Categories' },
    { value: 'system', label: 'System' },
    { value: 'transactional', label: 'Transactional' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'notification', label: 'Notification' },
  ];

  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  const templateTypeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'platform', label: 'Platform Templates' },
    { value: 'shared', label: 'Shared Templates' },
    { value: 'tenant', label: 'Tenant Templates' },
  ];

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await getTemplates({
        ...filters,
        page: currentPage,
        limit,
      });
      setTemplates(response.data);
      setTotalPages(response.meta.total_pages);
      setTotalCount(response.meta.total_count);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [currentPage, filters]);

  // Apply filters
  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setCurrentPage(1);
    setShowFilters(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    const clearedFilters: GetTemplatesParams = { page: 1, limit };
    setTempFilters(clearedFilters);
    setFilters(clearedFilters);
    setCurrentPage(1);
    setShowFilters(false);
  };

  // Delete template
  const handleDelete = async (templateKey: string) => {
    try {
      await deleteTemplate(templateKey);
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete template');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Active filters count
  const activeFiltersCount = Object.keys(filters).filter(
    key => key !== 'page' && key !== 'limit' && filters[key as keyof GetTemplatesParams]
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Email Templates (Admin)
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage all email templates including system templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="secondary"
            className="relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Link href="/admin/communications/templates/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New System Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Template Type"
              options={templateTypeOptions}
              value={tempFilters.template_type || ''}
              onChange={(value) => setTempFilters({ ...tempFilters, template_type: value as any })}
            />

            <Select
              label="Category"
              options={categoryOptions}
              value={tempFilters.category || ''}
              onChange={(value) => setTempFilters({ ...tempFilters, category: value as any })}
            />

            <Select
              label="Status"
              options={statusOptions}
              value={tempFilters.is_active !== undefined ? String(tempFilters.is_active) : ''}
              onChange={(value) => setTempFilters({ ...tempFilters, is_active: value ? value === 'true' : undefined })}
            />

            <Input
              label="Search"
              type="text"
              value={tempFilters.search || ''}
              onChange={(e) => setTempFilters({ ...tempFilters, search: e.target.value })}
              placeholder="Search templates..."
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={handleClearFilters} variant="secondary">
              Clear All
            </Button>
            <Button onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {!loading && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {templates.length} of {totalCount} template{totalCount === 1 ? '' : 's'}
        </div>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            No templates found
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {activeFiltersCount > 0
              ? 'Try adjusting your filters to see more results'
              : 'Get started by creating your first system template'}
          </p>
          {activeFiltersCount === 0 && (
            <Link href="/admin/communications/templates/new">
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create System Template
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setPreviewModal(template.template_key)}
              onDelete={() => setDeleteConfirm(template.template_key)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onNext={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            onPrevious={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            onGoToPage={setCurrentPage}
          />
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          isOpen
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm)}
          title="Delete Template"
          message="Are you sure you want to delete this template? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      )}

      {/* Preview Modal */}
      {previewModal && (
        <TemplatePreviewModal
          templateKey={previewModal}
          onClose={() => setPreviewModal(null)}
        />
      )}
    </div>
  );
}

// Template Card Component (Admin version - can edit system templates)
function TemplateCard({
  template,
  onPreview,
  onDelete,
}: {
  template: EmailTemplate;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const categoryColors: Record<string, string> = {
    system: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    transactional: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    marketing: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    notification: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate font-mono">
            {template.template_key}
          </h3>
          {template.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {template.description}
            </p>
          )}
        </div>
        <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded ${categoryColors[template.category]}`}>
          {template.category}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <TemplateTypeBadge type={template.template_type} />
        {template.tenant_id && template.template_type === 'tenant' && (
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded font-medium">
            Tenant: {template.tenant_id.substring(0, 8)}...
          </span>
        )}
        {!template.is_active && (
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
            Inactive
          </span>
        )}
        <span className="ml-auto">{format(new Date(template.created_at), 'MMM d, yyyy')}</span>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onPreview}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
        {/* Admin can edit ALL templates including system templates */}
        <Link
          href={`/admin/communications/templates/${template.template_key}/edit`}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <Edit className="h-4 w-4" />
          Edit
        </Link>
        <button
          onClick={onDelete}
          className="flex items-center justify-center p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Delete template"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Template Preview Modal (same as tenant version)
function TemplatePreviewModal({ templateKey, onClose }: { templateKey: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        const data = await previewTemplate(templateKey, { sample_data: {} });
        setPreview(data);
      } catch (error) {
        console.error('Failed to load preview:', error);
        toast.error('Failed to load preview');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [templateKey]);

  return (
    <Modal isOpen onClose={onClose} title="Template Preview" size="lg">
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : preview ? (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Subject</h4>
            <p className="text-sm text-gray-900 dark:text-gray-100 p-3 bg-gray-50 dark:bg-gray-900 rounded">
              {preview.subject}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">HTML Preview</h4>
            <div
              className="p-4 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: preview.html_body }}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
