/**
 * Attachment Card Component
 * Displays single attachment with preview, type badge, and actions
 * Supports drag-and-drop reordering
 */

'use client';

import React from 'react';
import {
  Image as ImageIcon,
  Link as LinkIcon,
  Grid3x3,
  Edit,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Image from 'next/image';
import type { QuoteAttachment } from '@/lib/types/quotes';
import { isPhotoAttachment, isUrlAttachment, getGridLayoutName } from '@/lib/api/quote-attachments';
import { buildFileUrl } from '@/lib/api/files';
import { QRCodePreview } from './QRCodePreview';

interface AttachmentCardProps {
  attachment: QuoteAttachment;
  onEdit: (attachment: QuoteAttachment) => void;
  onDelete: (attachment: QuoteAttachment) => void;
  draggable?: boolean;
  dragHandleProps?: any;
  className?: string;
  readOnly?: boolean;
}

export function AttachmentCard({
  attachment,
  onEdit,
  onDelete,
  draggable = false,
  dragHandleProps,
  className = '',
  readOnly = false,
}: AttachmentCardProps) {
  const getTypeBadge = () => {
    const variants: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
      cover_photo: {
        icon: <ImageIcon className="w-3 h-3" />,
        label: 'Cover Photo',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      },
      full_page_photo: {
        icon: <ImageIcon className="w-3 h-3" />,
        label: 'Full Page',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      },
      grid_photo: {
        icon: <Grid3x3 className="w-3 h-3" />,
        label: getGridLayoutName(attachment.grid_layout),
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      },
      url_attachment: {
        icon: <LinkIcon className="w-3 h-3" />,
        label: 'URL + QR Code',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      },
    };

    const config = variants[attachment.attachment_type];
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </div>
    );
  };

  const getPreview = () => {
    if (isUrlAttachment(attachment) && attachment.qr_code_file) {
      return (
        <QRCodePreview
          qrCodeUrl={buildFileUrl(attachment.qr_code_file.url)}
          targetUrl={attachment.url || ''}
          title={attachment.title || undefined}
          size="small"
          showActions={false}
        />
      );
    }

    if (isPhotoAttachment(attachment) && attachment.file) {
      return (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700">
          <Image
            src={buildFileUrl(attachment.file.url)}
            alt={attachment.title || 'Attachment'}
            fill
            className="object-cover"
          />
        </div>
      );
    }

    return (
      <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <ImageIcon className="w-8 h-8 text-gray-400" />
      </div>
    );
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors ${className}`}
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        {draggable && !readOnly && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing pt-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <GripVertical className="w-5 h-5" />
          </div>
        )}

        {/* Preview */}
        <div className="flex-shrink-0">
          {getPreview()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type Badge */}
          <div className="mb-2">
            {getTypeBadge()}
          </div>

          {/* Title */}
          {attachment.title && (
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 truncate">
              {attachment.title}
            </h4>
          )}

          {/* URL for URL attachments */}
          {isUrlAttachment(attachment) && attachment.url && (
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
            >
              {attachment.url}
            </a>
          )}

          {/* File Details for Photo attachments */}
          {isPhotoAttachment(attachment) && attachment.file && (
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
              <p className="truncate">{attachment.file.original_filename}</p>
              {attachment.file.width && attachment.file.height && (
                <p>
                  {attachment.file.width} × {attachment.file.height} px
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex items-start gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(attachment)}
              className="p-2"
            >
              <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </Button>
            <Button
              variant="ghost"
            size="sm"
            onClick={() => onDelete(attachment)}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </Button>
        </div>
        )}
      </div>
    </div>
  );
}

export default AttachmentCard;
