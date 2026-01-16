/**
 * Subscription History Component
 * Timeline of subscription changes
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Clock, User, ArrowRight } from 'lucide-react';
import { getTenantSubscriptionHistory } from '@/lib/api/admin';
import type { SubscriptionHistoryEntry } from '@/lib/types/admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface SubscriptionHistoryProps {
  tenantId: string;
}

export function SubscriptionHistory({ tenantId }: SubscriptionHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<SubscriptionHistoryEntry[]>([]);

  useEffect(() => {
    loadHistory();
  }, [tenantId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await getTenantSubscriptionHistory(tenantId);
      setHistory(response.history || []);
    } catch (error) {
      console.error('Failed to load subscription history:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseChanges = (changesStr: string) => {
    try {
      return JSON.parse(changesStr);
    } catch {
      return {};
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading history...</span>
        </div>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No subscription changes yet</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Subscription History</h2>

      <div className="space-y-6">
        {history.map((entry, index) => {
          const before = parseChanges(entry.changes.before);
          const after = parseChanges(entry.changes.after);

          return (
            <div key={entry.id} className="relative">
              {/* Timeline line */}
              {index < history.length - 1 && (
                <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
              )}

              <div className="flex gap-4">
                {/* Timeline dot */}
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{entry.description}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-400">
                          <User className="w-4 h-4" />
                          <span>{entry.changed_by.name}</span>
                          <span>•</span>
                          <span>{formatDate(entry.changed_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Changes Details */}
                    <div className="space-y-2">
                      {/* Plan Name Change */}
                      {before.plan_name && after.plan_name && before.plan_name !== after.plan_name && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Plan:</span>
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                            {before.plan_name}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            {after.plan_name}
                          </span>
                        </div>
                      )}

                      {/* Subscription Status Change */}
                      {before.subscription_status && after.subscription_status && before.subscription_status !== after.subscription_status && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded capitalize">
                            {before.subscription_status}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded capitalize">
                            {after.subscription_status}
                          </span>
                        </div>
                      )}

                      {/* Billing Cycle Change */}
                      {before.billing_cycle && after.billing_cycle && before.billing_cycle !== after.billing_cycle && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Billing Cycle:</span>
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded capitalize">
                            {before.billing_cycle}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded capitalize">
                            {after.billing_cycle}
                          </span>
                        </div>
                      )}

                      {/* Trial End Date Change */}
                      {(before.trial_end_date || after.trial_end_date) && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Trial Ends:</span>
                          {before.trial_end_date && (
                            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                              {new Date(before.trial_end_date).toLocaleDateString()}
                            </span>
                          )}
                          {before.trial_end_date && after.trial_end_date && <ArrowRight className="w-4 h-4 text-gray-400" />}
                          {after.trial_end_date && (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                              {new Date(after.trial_end_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Next Billing Date Change */}
                      {(before.next_billing_date || after.next_billing_date) && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Next Billing:</span>
                          {before.next_billing_date && (
                            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                              {new Date(before.next_billing_date).toLocaleDateString()}
                            </span>
                          )}
                          {before.next_billing_date && after.next_billing_date && <ArrowRight className="w-4 h-4 text-gray-400" />}
                          {after.next_billing_date && (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                              {new Date(after.next_billing_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
