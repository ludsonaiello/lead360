/**
 * FileRow Component
 * List view item for file gallery
 */

'use client';

import React from 'react';
import { Download, Share2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { FileThumbnail } from './FileThumbnail';
import type { File } from '@/lib/types/files';
import {
  formatFileSize,
  formatFileDate,
  formatFileCategory,
  getFileCategoryColor,
  truncateFilename,
} from '@/lib/utils/file-helpers';

interface FileRowProps {
  file: File;
  isSelected?: boolean;
  onSelect?: (fileId: string) => void;
  onClick?: (file: File) => void;
  onDownload?: (file: File) => void;
  onShare?: (file: File) => void;
  onDelete?: (file: File) => void;
}

export function FileRow({
  file,
  isSelected = false,
  onSelect,
  onClick,
  onDownload,
  onShare,
  onDelete,
}: FileRowProps) {
  const handleRowClick = () => {
    onClick?.(file);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(file.file_id);
  };

  const handleActionClick = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };

  const categoryColor = getFileCategoryColor(file.category);

  return (
    <div
      className={`
        group grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700
        hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer
        ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
      `}
      onClick={handleRowClick}
    >
      {/* Checkbox */}
      {onSelect && (
        <div className="col-span-1 flex items-center" onClick={handleCheckboxClick}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      )}

      {/* Thumbnail */}
      <div className={`${onSelect ? 'col-span-1' : 'col-span-1'} flex items-center`}>
        <FileThumbnail file={file} size="sm" />
      </div>

      {/* Filename */}
      <div className="col-span-3 flex items-center">
        <span
          className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
          title={file.original_filename}
        >
          {truncateFilename(file.original_filename, 40)}
        </span>
      </div>

      {/* Category */}
      <div className="col-span-2 flex items-center">
        <Badge variant={categoryColor as any} label={formatFileCategory(file.category)} />
      </div>

      {/* Entity */}
      <div className="col-span-2 flex items-center">
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate" title={file.entity_name}>
          {file.entity_name || '-'}
        </span>
      </div>

      {/* Size */}
      <div className="col-span-1 flex items-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatFileSize(file.size_bytes)}
        </span>
      </div>

      {/* Date */}
      <div className="col-span-1 flex items-center">
        <span className="text-sm text-gray-500 dark:text-gray-500">
          {formatFileDate(file.created_at)}
        </span>
      </div>

      {/* Actions */}
      <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onDownload && (
          <button
            onClick={handleActionClick(() => onDownload(file))}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        )}
        {onShare && (
          <button
            onClick={handleActionClick(() => onShare(file))}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Share"
          >
            <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleActionClick(() => onDelete(file))}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
}
