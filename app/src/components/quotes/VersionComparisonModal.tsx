/**
 * Version Comparison Modal Component
 * Side-by-side version comparison with color-coded diff view
 * Shows changes in items, groups, settings, and totals
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  FileText,
  List,
  Settings,
  Code,
  Download,
  Plus,
  Minus,
  Edit,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import {
  compareVersions,
  formatVersionNumber,
  getVersionNumberString,
  type QuoteVersion,
  type VersionComparison,
} from '@/lib/api/quote-versions';
import toast from 'react-hot-toast';

interface VersionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromVersion: QuoteVersion;
  toVersion: QuoteVersion;
}

export function VersionComparisonModal({
  isOpen,
  onClose,
  fromVersion,
  toVersion,
}: VersionComparisonModalProps) {
  const [activeTab, setActiveTab] = useState('changes');
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch comparison data
  useEffect(() => {
    if (isOpen) {
      fetchComparison();
    }
  }, [isOpen, fromVersion.id, toVersion.id]);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const fromVersionNum = getVersionNumberString(fromVersion);
      const toVersionNum = getVersionNumberString(toVersion);
      const data = await compareVersions(fromVersion.quote_id, fromVersionNum, toVersionNum);
      setComparison(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to compare versions');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Format money
  const formatMoney = (amount: number): string => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalContent
        icon={<FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
        title="Version Comparison"
        description="View changes between versions"
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : comparison ? (
          <>
            {/* Version Info Header */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-bold text-blue-900 dark:text-blue-100">
                    From: {formatVersionNumber(fromVersion.version_number)}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                    {formatDate(comparison.from_created_at)}
                  </p>
                </div>
                <ArrowRight className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div className="text-right">
                  <p className="font-bold text-blue-900 dark:text-blue-100">
                    To: {formatVersionNumber(toVersion.version_number)}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                    {formatDate(comparison.to_created_at)}
                  </p>
                </div>
              </div>
              {comparison.to_change_summary && (
                <p className="mt-3 text-sm text-blue-800 dark:text-blue-200 italic">
                  {comparison.to_change_summary}
                </p>
              )}
            </div>

            {/* Tabs */}
            <Tabs
              tabs={[
                { id: 'changes', label: 'Changes', icon: FileText },
                { id: 'items', label: 'Items', icon: List },
                { id: 'totals', label: 'Totals', icon: Settings },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
              className="mb-6"
            />

            {/* Tab Content */}
            <div className="max-h-[500px] overflow-y-auto">
              {activeTab === 'changes' && (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Items Added</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {comparison.summary.items_added}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Items Removed</p>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {comparison.summary.items_removed}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Items Modified</p>
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {comparison.summary.items_modified}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Total Change</p>
                      <p className={`text-2xl font-bold ${
                        comparison.summary.total_change_amount >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {comparison.summary.total_change_amount >= 0 ? '+' : ''}
                        {formatMoney(comparison.summary.total_change_amount)}
                      </p>
                    </div>
                  </div>

                  {/* Items Added */}
                  {comparison.differences.items.added.length > 0 && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-3">
                        <Plus className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <h4 className="font-semibold text-green-900 dark:text-green-100">
                          Items Added ({comparison.differences.items.added.length})
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {comparison.differences.items.added.map((item: any, index: number) => (
                          <div key={index} className="text-sm text-green-800 dark:text-green-200">
                            • {item.title || 'Untitled Item'}
                            {item.total_price && (
                              <span className="ml-2 font-semibold">
                                {formatMoney(item.total_price)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Items Removed */}
                  {comparison.differences.items.removed.length > 0 && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 mb-3">
                        <Minus className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <h4 className="font-semibold text-red-900 dark:text-red-100">
                          Items Removed ({comparison.differences.items.removed.length})
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {comparison.differences.items.removed.map((item: any, index: number) => (
                          <div key={index} className="text-sm text-red-800 dark:text-red-200 line-through">
                            • {item.title || 'Untitled Item'}
                            {item.total_price && (
                              <span className="ml-2 font-semibold">
                                {formatMoney(item.total_price)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Items Modified */}
                  {comparison.differences.items.modified.length > 0 && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-2 mb-3">
                        <Edit className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">
                          Items Modified ({comparison.differences.items.modified.length})
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {comparison.differences.items.modified.map((item: any, index: number) => (
                          <div key={index} className="text-sm text-yellow-800 dark:text-yellow-200">
                            • {item.title || 'Untitled Item'}
                            {item.changes && (
                              <span className="ml-2 text-xs">
                                ({Object.keys(item.changes).join(', ')} changed)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Changes */}
                  {comparison.summary.items_added === 0 &&
                    comparison.summary.items_removed === 0 &&
                    comparison.summary.items_modified === 0 && (
                      <div className="text-center py-8">
                        <p className="text-gray-600 dark:text-gray-400">
                          No changes detected between these versions
                        </p>
                      </div>
                    )}
                </div>
              )}

              {activeTab === 'items' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* From Version Items */}
                    <div>
                      <h4 className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">
                        {formatVersionNumber(fromVersion.version_number)} Items
                      </h4>
                      <div className="space-y-2">
                        {fromVersion.snapshot_data?.items?.slice(0, 10).map((item: any, index: number) => (
                          <div key={index} className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                            <p className="font-medium truncate">{item.title}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Qty: {item.quantity} × {formatMoney(item.material_cost_per_unit || 0)}
                            </p>
                          </div>
                        ))}
                        {fromVersion.snapshot_data?.items?.length > 10 && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                            + {fromVersion.snapshot_data.items.length - 10} more items
                          </p>
                        )}
                      </div>
                    </div>

                    {/* To Version Items */}
                    <div>
                      <h4 className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">
                        {formatVersionNumber(toVersion.version_number)} Items
                      </h4>
                      <div className="space-y-2">
                        {toVersion.snapshot_data?.items?.slice(0, 10).map((item: any, index: number) => (
                          <div key={index} className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                            <p className="font-medium truncate">{item.title}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Qty: {item.quantity} × {formatMoney(item.material_cost_per_unit || 0)}
                            </p>
                          </div>
                        ))}
                        {toVersion.snapshot_data?.items?.length > 10 && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                            + {toVersion.snapshot_data.items.length - 10} more items
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'totals' && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold mb-4 text-blue-900 dark:text-blue-100">
                      Financial Comparison
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {formatVersionNumber(fromVersion.version_number)}
                        </p>
                        <p className="text-lg font-bold">
                          {formatMoney(fromVersion.snapshot_data?.quote?.total || 0)}
                        </p>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRight className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {formatVersionNumber(toVersion.version_number)}
                        </p>
                        <p className="text-lg font-bold">
                          {formatMoney(toVersion.snapshot_data?.quote?.total || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Net Change:</span>
                        <span className={`text-xl font-bold ${
                          comparison.summary.total_change_amount >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {comparison.summary.total_change_amount >= 0 ? '+' : ''}
                          {formatMoney(comparison.summary.total_change_amount)}
                          {comparison.summary.total_change_percent !== 0 && (
                            <span className="text-sm ml-2">
                              ({comparison.summary.total_change_percent >= 0 ? '+' : ''}
                              {comparison.summary.total_change_percent.toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </ModalContent>

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default VersionComparisonModal;
