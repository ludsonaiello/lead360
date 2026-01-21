/**
 * Template Gallery Page
 * Browse and clone shared email templates
 * Shared templates are created by platform admins for all tenants to use
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Copy, Eye, Filter, X, FileText } from 'lucide-react';
import { getTemplates, previewTemplate, cloneTemplate } from '@/lib/api/communication';
import type { EmailTemplate, GetTemplatesParams } from '@/lib/types/communication';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { TemplateTypeBadge } from '@/components/communication/TemplateTypeBadge';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

export default function TemplateGalleryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneParam = searchParams.get('clone');

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [previewModal, setPreviewModal] = useState<string | null>(null);
  const [cloneModal, setCloneModal] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Filters
  const [filters, setFilters] = useState<GetTemplatesParams>({
    template_type: 'shared', // Only show shared templates
    page: 1,
    limit,
  });

  const [tempFilters, setTempFilters] = useState<GetTemplatesParams>({
    template_type: 'shared',
    page: 1,
    limit,
  });

  // Filter options
  const categoryOptions: SelectOption[] = [
    { value: '', label: 'All Categories' },
    { value: 'transactional', label: 'Transactional' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'notification', label: 'Notification' },
  ];

  // Fetch shared templates
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
      toast.error('Failed to load template gallery');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [currentPage, filters]);

  // Open clone modal from URL parameter
  useEffect(() => {
    if (cloneParam) {
      setCloneModal(cloneParam);
    }
  }, [cloneParam]);

  // Apply filters
  const handleApplyFilters = () => {
    setFilters({ ...tempFilters, template_type: 'shared' });
    setCurrentPage(1);
    setShowFilters(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    const clearedFilters: GetTemplatesParams = {
      template_type: 'shared',
      page: 1,
      limit
    };
    setTempFilters(clearedFilters);
    setFilters(clearedFilters);
    setCurrentPage(1);
    setShowFilters(false);
  };

  // Active filters count (excluding template_type which is always 'shared')
  const activeFiltersCount = Object.keys(filters).filter(
    key => key !== 'page' && key !== 'limit' && key !== 'template_type' && filters[key as keyof GetTemplatesParams]
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/communications/templates">
          <Button variant="secondary" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Templates
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Template Gallery
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Browse and use pre-made email templates. Click "Use Template" to customize for your business.
            </p>
          </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Category"
              options={categoryOptions}
              value={tempFilters.category || ''}
              onChange={(value) => setTempFilters({ ...tempFilters, category: value as any })}
            />

            <Input
              label="Search"
              type="text"
              value={tempFilters.search || ''}
              onChange={(e) => setTempFilters({ ...tempFilters, search: e.target.value })}
              placeholder="Search templates..."
              leftIcon={<Search className="h-4 w-4" />}
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
          Showing {templates.length} of {totalCount} shared template{totalCount === 1 ? '' : 's'}
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
            No shared templates found
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {activeFiltersCount > 0
              ? 'Try adjusting your filters to see more templates'
              : 'Check back later for new templates from our team'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <GalleryTemplateCard
              key={template.id}
              template={template}
              onPreview={() => setPreviewModal(template.template_key)}
              onClone={() => setCloneModal(template.template_key)}
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

      {/* Preview Modal */}
      {previewModal && (
        <TemplatePreviewModal
          templateKey={previewModal}
          onClose={() => setPreviewModal(null)}
        />
      )}

      {/* Clone Modal */}
      {cloneModal && (
        <CloneTemplateModal
          templateKey={cloneModal}
          onClose={() => {
            setCloneModal(null);
            router.push('/communications/templates/gallery');
          }}
          onSuccess={() => {
            fetchTemplates();
            setCloneModal(null);
            router.push('/communications/templates');
          }}
        />
      )}
    </div>
  );
}

// Gallery Template Card Component
function GalleryTemplateCard({
  template,
  onPreview,
  onClone,
}: {
  template: EmailTemplate;
  onPreview: () => void;
  onClone: () => void;
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
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
        <button
          onClick={onClone}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
        >
          <Copy className="h-4 w-4" />
          Use Template
        </button>
      </div>
    </div>
  );
}

// Template Preview Modal
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

// Clone Template Modal
function CloneTemplateModal({
  templateKey,
  onClose,
  onSuccess,
}: {
  templateKey: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newTemplateKey, setNewTemplateKey] = useState('');
  const [description, setDescription] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!newTemplateKey) {
      newErrors.template_key = 'Template key is required';
    } else if (!/^[a-z0-9-_]+$/.test(newTemplateKey)) {
      newErrors.template_key = 'Template key must be lowercase with hyphens/underscores only';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClone = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsCloning(true);
      await cloneTemplate(templateKey, {
        new_template_key: newTemplateKey,
        description: description || undefined,
      });
      toast.success('Template cloned successfully! You can now customize it.');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to clone template:', error);
      toast.error(error?.response?.data?.message || 'Failed to clone template');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Use This Template" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This will create a copy of <span className="font-mono font-semibold">{templateKey}</span> that you can customize for your business.
        </p>

        <Input
          label="New Template Key"
          type="text"
          value={newTemplateKey}
          onChange={(e) => setNewTemplateKey(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
          placeholder="my-custom-template"
          required
          error={errors.template_key}
          helperText="Unique identifier (lowercase, hyphens/underscores only)"
        />

        <Input
          label="Description (Optional)"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Customized version for our brand"
          helperText="Add a note about how you'll use this template"
        />

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={onClose} variant="secondary" disabled={isCloning}>
            Cancel
          </Button>
          <Button onClick={handleClone} disabled={isCloning}>
            {isCloning ? (
              <>
                <LoadingSpinner />
                Cloning...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Clone Template
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
