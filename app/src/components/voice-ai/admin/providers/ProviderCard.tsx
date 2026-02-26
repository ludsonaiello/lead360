'use client';

// ============================================================================
// ProviderCard Component
// ============================================================================
// Display individual provider with logo, type badge, and action buttons
// ============================================================================

import React from 'react';
import { Edit2, Trash2, ExternalLink, Calendar } from 'lucide-react';
import type { VoiceAIProvider } from '@/lib/types/voice-ai';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface ProviderCardProps {
  provider: VoiceAIProvider;
  onEdit?: (providerId: string) => void;
  onDelete?: (providerId: string) => void;
}

/**
 * Get badge variant based on provider type
 */
const getProviderTypeBadge = (type: string) => {
  switch (type) {
    case 'STT':
      return { variant: 'blue' as const, label: 'Speech-to-Text' };
    case 'LLM':
      return { variant: 'purple' as const, label: 'Language Model' };
    case 'TTS':
      return { variant: 'green' as const, label: 'Text-to-Speech' };
    default:
      return { variant: 'neutral' as const, label: type };
  }
};

/**
 * ProviderCard - Display provider information with actions
 */
export default function ProviderCard({
  provider,
  onEdit,
  onDelete,
}: ProviderCardProps) {
  const typeBadge = getProviderTypeBadge(provider.provider_type);
  const createdDate = new Date(provider.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Logo and details */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Logo */}
          {provider.logo_url ? (
            <img
              src={provider.logo_url}
              alt={`${provider.display_name} logo`}
              className="w-12 h-12 rounded-lg object-contain bg-gray-50 dark:bg-gray-700 p-1.5 flex-shrink-0"
              onError={(e) => {
                // Fallback if image fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-gray-400 dark:text-gray-500">
                {provider.display_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Details */}
          <div className="flex-1 min-w-0">
            {/* Title and badges */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {provider.display_name}
              </h3>
              <Badge {...typeBadge} />
              {provider.is_active ? (
                <Badge variant="success" label="Active" />
              ) : (
                <Badge variant="neutral" label="Inactive" />
              )}
            </div>

            {/* Provider key */}
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mb-2">
              {provider.provider_key}
            </p>

            {/* Description */}
            {provider.description && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                {provider.description}
              </p>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Created {createdDate}</span>
              </div>

              {provider.documentation_url && (
                <a
                  href={provider.documentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Documentation</span>
                </a>
              )}
            </div>

            {/* Capabilities */}
            {provider.capabilities && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(() => {
                  try {
                    const caps = JSON.parse(provider.capabilities) as string[];
                    return caps.slice(0, 5).map((cap) => (
                      <span
                        key={cap}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {cap}
                      </span>
                    ));
                  } catch {
                    return null;
                  }
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onEdit && (
            <Button
              onClick={() => onEdit(provider.id)}
              variant="secondary"
              size="sm"
              className="flex items-center gap-1.5"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </Button>
          )}

          {onDelete && (
            <Button
              onClick={() => onDelete(provider.id)}
              variant="danger"
              size="sm"
              className="flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
