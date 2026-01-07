/**
 * FileCard Component
 * Grid view item for file gallery
 */

'use client';

import React from 'react';
import { MoreVertical, Download, Share2, Trash2 } from 'lucide-react';
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

interface FileCardProps {
  file: File;
  isSelected?: boolean;
  onSelect?: (fileId: string) => void;
  onClick?: (file: File) => void;
  onDownload?: (file: File) => void;
  onShare?: (file: File) => void;
  onDelete?: (file: File) => void;
}

export function FileCard({
  file,
  isSelected = false,
  onSelect,
  onClick,
  onDownload,
  onShare,
  onDelete,
}: FileCardProps) {
  const [showMenu, setShowMenu] = React.useState(false);

  const handleCardClick = () => {
    onClick?.(file);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(file.file_id);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleActionClick = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    setShowMenu(false);
  };

  const categoryColor = getFileCategoryColor(file.category);

  return (
    <div
      className={`
        group relative bg-white dark:bg-gray-800 rounded-lg border-2 transition-all cursor-pointer
        ${isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'}
      `}
      onClick={handleCardClick}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div
          className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCheckboxClick}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      )}

      {/* Actions Menu */}
      <div className="absolute top-2 right-2 z-10">
        <div className="relative">
          <button
            onClick={handleMenuClick}
            className="p-1.5 bg-white dark:bg-gray-700 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>

          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowMenu(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-30">
                {onDownload && (
                  <button
                    onClick={handleActionClick(() => onDownload(file))}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={handleActionClick(() => onShare(file))}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Link
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={handleActionClick(() => onDelete(file))}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Thumbnail */}
      <div className="p-4 flex justify-center">
        <FileThumbnail file={file} size="md" />
      </div>

      {/* File Info */}
      <div className="px-4 pb-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1"
            title={file.original_filename}
          >
            {truncateFilename(file.original_filename, 25)}
          </h3>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatFileSize(file.size_bytes)}
          </span>
          <Badge variant={categoryColor as any} label={formatFileCategory(file.category)} />
        </div>

        {file.entity_name && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={file.entity_name}>
            {file.entity_name}
          </p>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500">
          {formatFileDate(file.created_at)}
        </p>
      </div>
    </div>
  );
}
