'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  AlertTriangle,
  Trash2,
  Upload,
  Download,
  Filter,
  X,
  File,
  FileImage,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { Select } from '@/components/ui/Select';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getProjectDocuments,
  uploadProjectDocument,
  deleteProjectDocument,
  formatDate,
  getFileUrl,
} from '@/lib/api/projects';
import type { ProjectDocument, DocumentType } from '@/lib/types/projects';
import toast from 'react-hot-toast';

interface DocumentsTabProps {
  projectId: string;
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: 'Contract',
  permit: 'Permit',
  blueprint: 'Blueprint',
  agreement: 'Agreement',
  photo: 'Photo',
  other: 'Other',
};

const DOCUMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const UPLOAD_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const DOCUMENT_TYPE_BADGE_VARIANTS: Record<DocumentType, 'blue' | 'purple' | 'cyan' | 'orange' | 'green' | 'gray'> = {
  contract: 'blue',
  permit: 'purple',
  blueprint: 'cyan',
  agreement: 'orange',
  photo: 'green',
  other: 'gray',
};

const getDocumentIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' || ext === 'doc' || ext === 'docx') return <FileText className="w-5 h-5" />;
  if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'bmp'].includes(ext || ''))
    return <FileImage className="w-5 h-5" />;
  return <File className="w-5 h-5" />;
};

export default function DocumentsTab({ projectId }: DocumentsTabProps) {
  const { hasRole } = useRBAC();
  const canUpload = hasRole(['Owner', 'Admin', 'Manager']);
  const canDelete = hasRole(['Owner', 'Admin']);

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<DocumentType | ''>('');

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    document_type: 'other' as DocumentType,
    description: '',
    is_public: false,
  });
  const [uploading, setUploading] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ProjectDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { document_type?: DocumentType } = {};
      if (typeFilter) params.document_type = typeFilter;
      const result = await getProjectDocuments(projectId, params);
      setDocuments(result);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [projectId, typeFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) {
      toast.error('Please select a file');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('document_type', uploadForm.document_type);
      if (uploadForm.description.trim()) {
        formData.append('description', uploadForm.description.trim());
      }
      formData.append('is_public', String(uploadForm.is_public));

      await uploadProjectDocument(projectId, formData);
      toast.success('Document uploaded successfully');
      setShowUploadModal(false);
      setUploadForm({ file: null, document_type: 'other', description: '', is_public: false });
      loadDocuments();
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProjectDocument(projectId, deleteTarget.id);
      toast.success('Document deleted');
      setDeleteTarget(null);
      loadDocuments();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilter = typeFilter !== '';

  // Loading state
  if (loading && documents.length === 0) {
    return (
      <Card className="p-12 mt-6">
        <LoadingSpinner size="lg" centered />
      </Card>
    );
  }

  // Error state
  if (error && documents.length === 0) {
    return (
      <Card className="p-12 text-center mt-6">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
        <Button variant="secondary" size="sm" onClick={loadDocuments} className="mt-4">
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="w-48">
            <Select
              options={DOCUMENT_TYPE_OPTIONS}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val as DocumentType | '')}
              placeholder="All Types"
            />
          </div>
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={() => setTypeFilter('')}>
              <X className="w-3 h-3" />
              Clear
            </Button>
          )}
        </div>
        {canUpload && (
          <Button variant="primary" size="sm" onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Documents
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilter
              ? 'No documents match your filter.'
              : 'Upload your first document to get started.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Left: icon + info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    {getDocumentIcon(doc.file_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {doc.file_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge
                        variant={DOCUMENT_TYPE_BADGE_VARIANTS[doc.document_type]}
                        label={DOCUMENT_TYPE_LABELS[doc.document_type]}
                      />
                      {doc.is_public && (
                        <Badge variant="green" label="Public" />
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(doc.created_at)}
                      </span>
                    </div>
                    {doc.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2">
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={getFileUrl(doc.file_url) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => setDeleteTarget(doc)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          if (!uploading) {
            setShowUploadModal(false);
            setUploadForm({ file: null, document_type: 'other', description: '', is_public: false });
          }
        }}
        title="Upload Document"
        size="md"
      >
        <form onSubmit={handleUpload}>
          <div className="space-y-4">
            {/* File input */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                File <span className="text-red-500 dark:text-red-400 ml-1">*</span>
              </label>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadForm((prev) => ({ ...prev, file }));
                }}
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2.5 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  dark:file:bg-blue-900/30 dark:file:text-blue-300
                  hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50
                  file:cursor-pointer file:transition-colors"
              />
              {uploadForm.file && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Selected: {uploadForm.file.name}
                </p>
              )}
            </div>

            {/* Document type */}
            <Select
              label="Document Type"
              required
              options={UPLOAD_TYPE_OPTIONS}
              value={uploadForm.document_type}
              onChange={(val) =>
                setUploadForm((prev) => ({ ...prev, document_type: val as DocumentType }))
              }
            />

            {/* Description */}
            <Textarea
              label="Description"
              value={uploadForm.description}
              onChange={(e) =>
                setUploadForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional description..."
              maxLength={500}
              showCharacterCount
              rows={3}
            />

            {/* Public toggle */}
            <ToggleSwitch
              enabled={uploadForm.is_public}
              onChange={(val) => setUploadForm((prev) => ({ ...prev, is_public: val }))}
              label="Public (visible on customer portal)"
            />
          </div>

          <ModalActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowUploadModal(false);
                setUploadForm({ file: null, document_type: 'other', description: '', is_public: false });
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" loading={uploading} disabled={!uploadForm.file}>
              Upload
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteTarget?.file_name}"? This action cannot be undone.`}
        isDeleting={deleting}
      />
    </div>
  );
}
