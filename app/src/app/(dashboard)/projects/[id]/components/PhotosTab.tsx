'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image as ImageIcon,
  AlertTriangle,
  Trash2,
  Eye,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Upload,
  Calendar,
  User,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getPhotoTimeline,
  batchUploadPhotos,
  updateProjectPhoto,
  deleteProjectPhoto,
  formatDate,
  getFileUrl,
} from '@/lib/api/projects';
import type { TimelineDateGroup, TimelinePhoto, PhotoTimelineResponse } from '@/lib/types/projects';
import toast from 'react-hot-toast';

interface PhotosTabProps {
  projectId: string;
}

export default function PhotosTab({ projectId }: PhotosTabProps) {
  const { hasRole } = useRBAC();
  const canUpload = hasRole(['Owner', 'Admin', 'Manager', 'Field']);
  const canManage = hasRole(['Owner', 'Admin', 'Manager']);

  const [timeline, setTimeline] = useState<TimelineDateGroup[]>([]);
  const [meta, setMeta] = useState<PhotoTimelineResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [publicFilter, setPublicFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadIsPublic, setUploadIsPublic] = useState(false);
  const [uploadTakenAt, setUploadTakenAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<TimelinePhoto | null>(null);
  const [allPhotos, setAllPhotos] = useState<TimelinePhoto[]>([]);

  // Edit
  const [editPhoto, setEditPhoto] = useState<TimelinePhoto | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<TimelinePhoto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean> = { page, limit: 20 };
      if (publicFilter === 'true') params.is_public = true;
      if (publicFilter === 'false') params.is_public = false;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const result = await getPhotoTimeline(projectId, params);
      setTimeline(result.data);
      setMeta(result.meta);

      // Flatten all photos for lightbox navigation
      const flat = result.data.flatMap((group) => group.photos);
      setAllPhotos(flat);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, publicFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Upload handling
  const handleUploadFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length + uploadFiles.length > 20) {
      toast.error('Maximum 20 files per upload');
      return;
    }
    setUploadFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      uploadFiles.forEach((file) => formData.append('files', file));
      if (uploadCaption.trim()) formData.append('caption', uploadCaption.trim());
      formData.append('is_public', String(uploadIsPublic));
      if (uploadTakenAt) formData.append('taken_at', uploadTakenAt);

      await batchUploadPhotos(projectId, formData);
      toast.success(`${uploadFiles.length} photo${uploadFiles.length > 1 ? 's' : ''} uploaded`);
      setShowUpload(false);
      setUploadFiles([]);
      setUploadCaption('');
      setUploadIsPublic(false);
      setUploadTakenAt('');
      loadTimeline();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  // Lightbox navigation
  const currentPhotoIndex = lightboxPhoto ? allPhotos.findIndex((p) => p.id === lightboxPhoto.id) : -1;

  const goToNextPhoto = useCallback(() => {
    const idx = lightboxPhoto ? allPhotos.findIndex((p) => p.id === lightboxPhoto.id) : -1;
    if (idx < allPhotos.length - 1) {
      setLightboxPhoto(allPhotos[idx + 1]);
    }
  }, [lightboxPhoto, allPhotos]);

  const goToPrevPhoto = useCallback(() => {
    const idx = lightboxPhoto ? allPhotos.findIndex((p) => p.id === lightboxPhoto.id) : -1;
    if (idx > 0) {
      setLightboxPhoto(allPhotos[idx - 1]);
    }
  }, [lightboxPhoto, allPhotos]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxPhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxPhoto(null);
      if (e.key === 'ArrowLeft') goToPrevPhoto();
      if (e.key === 'ArrowRight') goToNextPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPhoto, goToNextPhoto, goToPrevPhoto]);

  // Edit photo
  const openEdit = (photo: TimelinePhoto) => {
    setEditPhoto(photo);
    setEditCaption(photo.caption || '');
    setEditIsPublic(photo.is_public);
  };

  const handleSaveEdit = async () => {
    if (!editPhoto) return;
    setSaving(true);
    try {
      await updateProjectPhoto(projectId, editPhoto.id, {
        caption: editCaption.trim() || undefined,
        is_public: editIsPublic,
      });
      toast.success('Photo updated');
      setEditPhoto(null);
      loadTimeline();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to update photo');
    } finally {
      setSaving(false);
    }
  };

  // Delete photo
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProjectPhoto(projectId, deleteTarget.id);
      toast.success('Photo deleted');
      setDeleteTarget(null);
      if (lightboxPhoto?.id === deleteTarget.id) setLightboxPhoto(null);
      loadTimeline();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setPublicFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = publicFilter || dateFrom || dateTo;

  const publicOptions = [
    { value: '', label: 'All' },
    { value: 'true', label: 'Public' },
    { value: 'false', label: 'Private' },
  ];

  if (loading && timeline.length === 0) {
    return (
      <Card className="p-12 mt-6">
        <LoadingSpinner size="lg" centered />
      </Card>
    );
  }

  if (error && timeline.length === 0) {
    return (
      <Card className="p-12 text-center mt-6">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
        <Button variant="secondary" size="sm" onClick={loadTimeline} className="mt-4">
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? 'text-blue-600 dark:text-blue-400' : ''}
        >
          <Filter className="w-4 h-4" />
          Filters {hasActiveFilters ? '(active)' : ''}
        </Button>
        {canUpload && (
          <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="w-4 h-4" />
            Upload Photos
          </Button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Visibility"
              options={publicOptions}
              value={publicFilter}
              onChange={(val) => { setPublicFilter(val); setPage(1); }}
            />
            <DatePicker
              label="From"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <DatePicker
              label="To"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
              <X className="w-3 h-3" />
              Clear Filters
            </Button>
          )}
        </Card>
      )}

      {/* Upload Panel */}
      {showUpload && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Upload Photos</h3>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors mb-4"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/bmp"
              className="hidden"
              onChange={handleUploadFilesChange}
            />
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click or drag & drop photos (max 20, 20MB each)
            </p>
          </div>

          {/* Preview grid */}
          {uploadFiles.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2 mb-4">
              {uploadFiles.map((file, i) => {
                const previewUrl = URL.createObjectURL(file);
                return (
                <div key={`${file.name}-${i}`} className="relative group aspect-square">
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                    onLoad={() => URL.revokeObjectURL(previewUrl)}
                  />
                  <button
                    type="button"
                    onClick={() => setUploadFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Input
              label="Caption (shared)"
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="e.g., Site progress"
              maxLength={500}
            />
            <DatePicker
              label="Date Taken"
              value={uploadTakenAt}
              onChange={(e) => setUploadTakenAt(e.target.value)}
            />
          </div>

          <ToggleSwitch
            enabled={uploadIsPublic}
            onChange={setUploadIsPublic}
            label="Public (visible on portal)"
          />

          <div className="flex gap-3 mt-4">
            <Button
              onClick={handleUpload}
              loading={uploading}
              disabled={uploadFiles.length === 0}
            >
              Upload {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}
            </Button>
            <Button variant="secondary" onClick={() => { setShowUpload(false); setUploadFiles([]); }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Timeline */}
      {timeline.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Photos
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilters ? 'No photos match your filters.' : 'Upload photos to build a progress timeline.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {timeline.map((group) => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {formatDate(group.date)}
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({group.photos.length} photo{group.photos.length > 1 ? 's' : ''})
                </span>
              </div>

              {/* Photo grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {group.photos.map((photo) => {
                  const thumbUrl = getFileUrl(photo.thumbnail_url) || getFileUrl(photo.file_url);
                  return (
                    <div
                      key={photo.id}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
                      onClick={() => setLightboxPhoto(photo)}
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={photo.caption || 'Project photo'}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-400" />
                        </div>
                      )}

                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                        <div className="w-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {photo.caption && (
                            <p className="text-xs text-white truncate">{photo.caption}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {photo.is_public && (
                              <Eye className="w-3 h-3 text-green-300" />
                            )}
                            {photo.task && (
                              <span className="text-[10px] text-blue-300 truncate">
                                {photo.task.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons on hover */}
                      {canManage && (
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(photo); }}
                            className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-full text-gray-700 dark:text-gray-300 hover:bg-white shadow"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(photo); }}
                            className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-full text-red-500 hover:bg-white shadow"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <PaginationControls
          currentPage={page}
          totalPages={meta.totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
        />
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxPhoto(null)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
            onClick={() => setLightboxPhoto(null)}
          >
            <X className="w-8 h-8" />
          </button>

          {/* Navigation */}
          {currentPhotoIndex > 0 && (
            <button
              className="absolute left-4 p-3 text-white/80 hover:text-white bg-black/30 rounded-full z-10"
              onClick={(e) => { e.stopPropagation(); goToPrevPhoto(); }}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          {currentPhotoIndex < allPhotos.length - 1 && (
            <button
              className="absolute right-4 p-3 text-white/80 hover:text-white bg-black/30 rounded-full z-10"
              onClick={(e) => { e.stopPropagation(); goToNextPhoto(); }}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Image */}
          <div className="max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={getFileUrl(lightboxPhoto.file_url) || ''}
              alt={lightboxPhoto.caption || 'Photo'}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            {/* Caption bar */}
            <div className="mt-3 text-center">
              {lightboxPhoto.caption && (
                <p className="text-white text-sm mb-1">{lightboxPhoto.caption}</p>
              )}
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                {lightboxPhoto.uploaded_by && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {lightboxPhoto.uploaded_by.first_name} {lightboxPhoto.uploaded_by.last_name}
                  </span>
                )}
                {lightboxPhoto.task && (
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {lightboxPhoto.task.title}
                  </span>
                )}
                <span>{currentPhotoIndex + 1} / {allPhotos.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Photo Modal */}
      {editPhoto && (
        <Modal isOpen={!!editPhoto} onClose={() => setEditPhoto(null)} title="Edit Photo" size="sm">
          <div className="space-y-4">
            <Input
              label="Caption"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              maxLength={500}
              placeholder="Photo caption..."
            />
            <ToggleSwitch
              enabled={editIsPublic}
              onChange={setEditIsPublic}
              label="Public (visible on portal)"
            />
            <ModalActions>
              <Button variant="secondary" onClick={() => setEditPhoto(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} loading={saving}>
                Save
              </Button>
            </ModalActions>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        isDeleting={deleting}
      />
    </div>
  );
}
