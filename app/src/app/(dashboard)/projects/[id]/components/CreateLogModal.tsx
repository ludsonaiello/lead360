'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, Image as ImageIcon, FileText, File } from 'lucide-react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Button } from '@/components/ui/Button';
import { createProjectLog } from '@/lib/api/projects';
import toast from 'react-hot-toast';

interface CreateLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
}

export default function CreateLogModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: CreateLogModalProps) {
  const [content, setContent] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPublic, setIsPublic] = useState(false);
  const [weatherDelay, setWeatherDelay] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILES = 10;
  const MAX_FILE_SIZE_MB = 20;

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    const totalFiles = files.length + newFiles.length;
    if (totalFiles > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }
    for (const file of newFiles) {
      if (file.size / (1024 * 1024) > MAX_FILE_SIZE_MB) {
        setError(`${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit`);
        return;
      }
    }
    setError(null);
    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-blue-500" />;
    if (file.type === 'application/pdf') return <FileText className="w-4 h-4 text-red-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      formData.append('log_date', logDate);
      formData.append('is_public', String(isPublic));
      formData.append('weather_delay', String(weatherDelay));
      files.forEach((file) => formData.append('attachments', file));

      await createProjectLog(projectId, formData);
      toast.success('Log entry created');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message || 'Failed to create log entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Log Entry" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          label="Content"
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Describe what happened today..."
          rows={5}
          maxLength={65535}
          showCharacterCount
        />

        <DatePicker
          label="Log Date"
          value={logDate}
          onChange={(e) => setLogDate(e.target.value)}
        />

        <div className="flex flex-col sm:flex-row gap-4">
          <ToggleSwitch
            enabled={isPublic}
            onChange={setIsPublic}
            label="Public (visible on portal)"
          />
          <ToggleSwitch
            enabled={weatherDelay}
            onChange={setWeatherDelay}
            label="Weather Delay"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Attachments (optional)
          </label>
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesChange}
              accept="image/*,application/pdf,.doc,.docx"
            />
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click to upload or drag & drop
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Max {MAX_FILES} files, {MAX_FILE_SIZE_MB}MB each
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(file)}
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {(file.size / (1024 * 1024)).toFixed(1)}MB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create Log Entry
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
