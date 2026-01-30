/**
 * Version Timeline Card Component
 * Vertical timeline display of all quote versions
 * Shows version history with actions to view, compare, and restore
 */

'use client';

import React, { useState } from 'react';
import {
  FileText,
  Copy,
  RotateCcw,
  Eye,
  CheckCircle2,
  Clock,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { VersionComparisonModal } from './VersionComparisonModal';
import { RestoreVersionModal } from './RestoreVersionModal';
import type { QuoteVersion } from '@/lib/api/quote-versions';
import { formatVersionNumber } from '@/lib/api/quote-versions';

interface VersionTimelineCardProps {
  versions: QuoteVersion[];
  loading?: boolean;
  onRestore?: () => void;
  className?: string;
}

export function VersionTimelineCard({
  versions,
  loading = false,
  onRestore,
  className = '',
}: VersionTimelineCardProps) {
  const [selectedForCompare, setSelectedForCompare] = useState<{
    from: QuoteVersion;
    to: QuoteVersion;
  } | null>(null);
  const [selectedForRestore, setSelectedForRestore] = useState<QuoteVersion | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  // Toggle version details expansion
  const toggleExpanded = (versionId: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get version change icon
  const getChangeIcon = (index: number) => {
    if (index === 0) return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
    return <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
  };

  // Get total from snapshot
  const getVersionTotal = (version: QuoteVersion): number => {
    return version.snapshot_data?.quote?.total || 0;
  };

  // Get item count from snapshot
  const getItemCount = (version: QuoteVersion): number => {
    return version.snapshot_data?.items?.length || 0;
  };

  // Calculate change from previous version
  const calculateChange = (currentVersion: QuoteVersion, previousVersion: QuoteVersion | undefined) => {
    if (!previousVersion) return null;

    const currentTotal = getVersionTotal(currentVersion);
    const previousTotal = getVersionTotal(previousVersion);
    const diff = currentTotal - previousTotal;

    if (diff === 0) return { type: 'none', amount: 0, icon: Minus };
    if (diff > 0) return { type: 'increase', amount: diff, icon: TrendingUp };
    return { type: 'decrease', amount: Math.abs(diff), icon: TrendingDown };
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center py-8">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No version history available
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={`p-6 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-lg font-bold">Version History</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {versions.length} version{versions.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          {versions.map((version, index) => {
            const isLatest = index === 0;
            const isExpanded = expandedVersions.has(version.id);
            const previousVersion = versions[index + 1];
            const change = calculateChange(version, previousVersion);
            const ChangeIcon = change?.icon;

            return (
              <div key={version.id} className="flex gap-4">
                {/* Timeline indicator */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                      isLatest
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {formatVersionNumber(version.version_number).replace('v', '')}
                  </div>
                  {index < versions.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 min-h-[40px] mt-2" />
                  )}
                </div>

                {/* Version info */}
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900 dark:text-gray-100">
                          Version {formatVersionNumber(version.version_number)}
                        </p>
                        {isLatest && (
                          <Badge variant="success" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(version.created_at)} at {formatTime(version.created_at)}
                        {version.created_by_user_id && (
                          <span className="ml-2">
                            by {version.created_by_user_id}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Change indicator */}
                    {change && ChangeIcon && change.type !== 'none' && (
                      <div
                        className={`flex items-center gap-1 text-sm font-semibold ${
                          change.type === 'increase'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        <ChangeIcon className="w-4 h-4" />
                        {change.type === 'increase' ? '+' : '-'}$
                        {change.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    )}
                  </div>

                  {/* Version stats */}
                  <div className="flex items-center gap-6 mb-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <FileText className="w-4 h-4" />
                      <span>{getItemCount(version)} items</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">
                        ${getVersionTotal(version).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(version.id)}
                    >
                      <Eye className="w-4 h-4" />
                      {isExpanded ? 'Hide' : 'View'} Details
                    </Button>

                    {index < versions.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSelectedForCompare({
                            from: versions[index + 1],
                            to: version,
                          })
                        }
                      >
                        <Copy className="w-4 h-4" />
                        Compare
                      </Button>
                    )}

                    {!isLatest && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedForRestore(version)}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
                      </Button>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold text-sm mb-3">Version Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                          <span className="font-medium">
                            ${version.snapshot_data?.quote?.subtotal?.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                          <span className="font-medium">
                            ${version.snapshot_data?.quote?.tax_amount?.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Discounts:</span>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            -${version.snapshot_data?.quote?.discount_amount?.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-900 dark:text-gray-100 font-semibold">Total:</span>
                          <span className="font-bold">
                            ${getVersionTotal(version).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Modals */}
      {selectedForCompare && (
        <VersionComparisonModal
          isOpen={true}
          onClose={() => setSelectedForCompare(null)}
          fromVersion={selectedForCompare.from}
          toVersion={selectedForCompare.to}
        />
      )}

      {selectedForRestore && (
        <RestoreVersionModal
          isOpen={true}
          onClose={() => setSelectedForRestore(null)}
          version={selectedForRestore}
          onRestore={() => {
            setSelectedForRestore(null);
            onRestore?.();
          }}
        />
      )}
    </>
  );
}

export default VersionTimelineCard;
