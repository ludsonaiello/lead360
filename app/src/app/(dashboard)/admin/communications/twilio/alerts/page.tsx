/**
 * System Alerts Management Page (Sprint 8)
 * Admin interface for managing system alerts
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, X, Loader2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { AlertCard } from '@/components/admin/twilio/alerts/AlertCard';
import { AcknowledgeAlertModal } from '@/components/admin/twilio/alerts/AcknowledgeAlertModal';
import { ResolveAlertModal } from '@/components/admin/twilio/alerts/ResolveAlertModal';
import { BulkAcknowledgeAlertsModal } from '@/components/admin/twilio/alerts/BulkAcknowledgeAlertsModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { Checkbox } from '@/components/ui/checkbox';
import { getSystemAlerts } from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import type { SystemAlertDetail, AlertsQuery } from '@/lib/types/twilio-admin';

export default function SystemAlertsPage() {
  // State
  const [alerts, setAlerts] = useState<SystemAlertDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(0);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<string>('');

  // Selection
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Modals
  const [acknowledgeModalOpen, setAcknowledgeModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [bulkAcknowledgeModalOpen, setBulkAcknowledgeModalOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<SystemAlertDetail | null>(null);

  // Fetch alerts
  const fetchAlerts = async () => {
    setLoading(true);
    setError('');

    try {
      const params: AlertsQuery = {
        page: currentPage,
        limit: 20,
      };

      if (severityFilter) {
        params.severity = severityFilter as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      }

      if (acknowledgedFilter === 'true') {
        params.acknowledged = true;
      } else if (acknowledgedFilter === 'false') {
        params.acknowledged = false;
      }

      const response = await getSystemAlerts(params);
      setAlerts(response.data);
      setTotalPages(response.pagination.pages);
      setTotalAlerts(response.pagination.total);
    } catch (err) {
      const message = getUserFriendlyError(err);
      setError(message);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Load alerts on mount and filter changes
  useEffect(() => {
    fetchAlerts();
    setSelectedAlertIds([]);
    setSelectAll(false);
  }, [currentPage, severityFilter, acknowledgedFilter]);

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedAlertIds(alerts.map((a) => a.id));
    } else {
      setSelectedAlertIds([]);
    }
  };

  // Handle individual selection
  const handleSelectAlert = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedAlertIds((prev) => [...prev, id]);
    } else {
      setSelectedAlertIds((prev) => prev.filter((alertId) => alertId !== id));
      setSelectAll(false);
    }
  };

  // Handle acknowledge
  const handleAcknowledge = (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (alert) {
      setActiveAlert(alert);
      setAcknowledgeModalOpen(true);
    }
  };

  // Handle resolve
  const handleResolve = (id: string, resolution: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (alert) {
      setActiveAlert(alert);
      setResolveModalOpen(true);
    }
  };

  // Handle bulk acknowledge
  const handleBulkAcknowledge = () => {
    if (selectedAlertIds.length > 0) {
      setBulkAcknowledgeModalOpen(true);
    }
  };

  // Handle success (refresh alerts)
  const handleSuccess = () => {
    fetchAlerts();
    setSelectedAlertIds([]);
    setSelectAll(false);
  };

  // Calculate summary stats
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const highCount = alerts.filter((a) => a.severity === 'HIGH').length;
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Alerts</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Monitor and manage system alerts across the platform
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-red-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Critical Alerts</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{criticalCount}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">High Priority</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {highCount}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unacknowledged</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {unacknowledgedCount}
              </p>
            </div>
            <X className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </Card>
      </div>

      {/* Filters and Bulk Actions */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <Select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto"
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>

            <Select
              value={acknowledgedFilter}
              onChange={(e) => {
                setAcknowledgedFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto"
            >
              <option value="">All Statuses</option>
              <option value="false">Unacknowledged</option>
              <option value="true">Acknowledged</option>
            </Select>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
              Select All
            </label>
            <Button
              onClick={handleBulkAcknowledge}
              disabled={selectedAlertIds.length === 0}
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Bulk Acknowledge ({selectedAlertIds.length})
            </Button>
          </div>
        </div>
      </Card>

      {/* Alerts List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : alerts.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            No alerts found matching your filters
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              onSelect={handleSelectAlert}
              selected={selectedAlertIds.includes(alert.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing page {currentPage} of {totalPages} ({totalAlerts} total alerts)
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Modals */}
      {activeAlert && (
        <>
          <AcknowledgeAlertModal
            isOpen={acknowledgeModalOpen}
            onClose={() => {
              setAcknowledgeModalOpen(false);
              setActiveAlert(null);
            }}
            alert={activeAlert}
            onSuccess={handleSuccess}
          />

          <ResolveAlertModal
            isOpen={resolveModalOpen}
            onClose={() => {
              setResolveModalOpen(false);
              setActiveAlert(null);
            }}
            alert={activeAlert}
            onSuccess={handleSuccess}
          />
        </>
      )}

      <BulkAcknowledgeAlertsModal
        isOpen={bulkAcknowledgeModalOpen}
        onClose={() => setBulkAcknowledgeModalOpen(false)}
        selectedAlertIds={selectedAlertIds}
        onSuccess={handleSuccess}
      />

      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error Loading Alerts"
        message={error}
      />
    </div>
  );
}
