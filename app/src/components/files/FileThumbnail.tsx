/**
 * FileThumbnail Component
 * Display file thumbnail or icon based on file type
 */

'use client';

import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Receipt,
  Award,
  Shield,
  Camera,
  FileBarChart,
  PenTool,
} from 'lucide-react';
import type { File } from '@/lib/types/files';
import { buildFileUrl } from '@/lib/api/files';
import { isImage, isPDF, getFileCategoryIcon } from '@/lib/utils/file-helpers';

interface FileThumbnailProps {
  file: File;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Image: ImageIcon,
  File: FileIcon,
  Receipt,
  Award,
  Shield,
  Camera,
  FileBarChart,
  PenTool,
};

export function FileThumbnail({ file, size = 'md', className = '' }: FileThumbnailProps) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-32 h-32',
    lg: 'w-64 h-64',
  };

  const iconSizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-16 h-16',
    lg: 'w-32 h-32',
  };

  // If file has thumbnail, show it
  if (file.has_thumbnail && file.thumbnail_url) {
    return (
      <div className={`${sizeClasses[size]} relative overflow-hidden rounded-lg ${className}`}>
        <img
          src={buildFileUrl(file.thumbnail_url)}
          alt={file.original_filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  // If image without thumbnail, show original (if URL exists)
  if (isImage(file.mime_type) && file.url) {
    const imageUrl = buildFileUrl(file.url);
    if (imageUrl) {
      return (
        <div className={`${sizeClasses[size]} relative overflow-hidden rounded-lg ${className}`}>
          <img
            src={imageUrl}
            alt={file.original_filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      );
    }
  }

  // Otherwise show icon based on category
  const iconName = getFileCategoryIcon(file.category);
  const IconComponent = ICON_MAP[iconName] || FileIcon;

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}
    >
      <IconComponent className={`${iconSizeClasses[size]} text-gray-400 dark:text-gray-500`} />
    </div>
  );
}
