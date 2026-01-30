/**
 * Approvals Page
 * Dedicated page for viewing and managing pending quote approvals
 */

'use client';

import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PendingApprovalsWidget } from '@/components/quotes/PendingApprovalsWidget';
import { getPendingApprovals } from '@/lib/api/quote-approvals';
import { Shield, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function ApprovalsPage() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch pending count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        setLoading(true);
        const response = await getPendingApprovals();
        setPendingCount(response.count || 0);
      } catch (error) {
        console.error('Failed to fetch pending approvals count:', error);
        setPendingCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-brand-600 dark:text-brand-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Quote Approvals
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Review and approve quotes that require your authorization
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white" id="pending-count">
                {loading ? (
                  <span className="text-gray-400">...</span>
                ) : (
                  pendingCount
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Quick Actions</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Approve/Reject from this page
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Auto-refresh</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Every 30 seconds
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending Approvals Widget */}
      <PendingApprovalsWidget autoRefreshInterval={30000} />
    </div>
  );
}
