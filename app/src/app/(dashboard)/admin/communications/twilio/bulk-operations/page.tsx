/**
 * Bulk Operations Page (Sprint 8)
 * Admin interface for batch retry operations
 */

'use client';

import React, { useState } from 'react';
import { RefreshCw, Download, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import {
  batchRetryTranscriptions,
  batchResendCommunicationEvents,
  batchRetryWebhookEvents,
} from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';

type OperationType = 'transcriptions' | 'events' | 'webhooks';

export default function BulkOperationsPage() {
  // State
  const [operationType, setOperationType] = useState<OperationType>('transcriptions');
  const [tenantId, setTenantId] = useState('');
  const [channel, setChannel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState('100');
  const [processing, setProcessing] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [result, setResult] = useState<{
    queued_count: number;
    message: string;
  } | null>(null);

  const handleExecute = async () => {
    setProcessing(true);

    try {
      let response;
      const limitNum = parseInt(limit) || 100;

      switch (operationType) {
        case 'transcriptions':
          response = await batchRetryTranscriptions({
            tenant_id: tenantId || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            limit: limitNum,
          });
          break;

        case 'events':
          response = await batchResendCommunicationEvents({
            tenant_id: tenantId || undefined,
            channel: (channel as 'sms' | 'whatsapp') || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            limit: limitNum,
          });
          break;

        case 'webhooks':
          response = await batchRetryWebhookEvents({
            tenant_id: tenantId || undefined,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            limit: limitNum,
          });
          break;
      }

      setResult({
        queued_count: response.queued_count,
        message: response.message,
      });
      setSuccessModalOpen(true);
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
    setResult(null);
  };

  const resetFilters = () => {
    setTenantId('');
    setChannel('');
    setStartDate('');
    setEndDate('');
    setLimit('100');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bulk Operations</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Batch retry failed transcriptions, communication events, and webhook events
        </p>
      </div>

      {/* Operation Type Selector */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Operation Type
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <button
                onClick={() => {
                  setOperationType('transcriptions');
                  resetFilters();
                }}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  operationType === 'transcriptions'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Retry Transcriptions
                  </p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Batch retry failed transcriptions
                </p>
              </button>

              <button
                onClick={() => {
                  setOperationType('events');
                  resetFilters();
                }}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  operationType === 'events'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Resend Messages
                  </p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Batch resend failed communication events
                </p>
              </button>

              <button
                onClick={() => {
                  setOperationType('webhooks');
                  resetFilters();
                }}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  operationType === 'webhooks'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-5 w-5 text-purple-600" />
                  <p className="font-medium text-gray-900 dark:text-gray-100">Retry Webhooks</p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Batch retry failed webhook events
                </p>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Filters (Optional)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tenant ID */}
          <div>
            <Label htmlFor="tenantId" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tenant ID
            </Label>
            <Input
              id="tenantId"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Filter by specific tenant (optional)"
              className="mt-1"
              disabled={processing}
            />
          </div>

          {/* Channel (only for communication events) */}
          {operationType === 'events' && (
            <div>
              <Label htmlFor="channel" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Channel
              </Label>
              <Select
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="mt-1"
                disabled={processing}
              >
                <option value="">All Channels</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </Select>
            </div>
          )}

          {/* Start Date */}
          <div>
            <Label htmlFor="startDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Start Date
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
              disabled={processing}
            />
          </div>

          {/* End Date */}
          <div>
            <Label htmlFor="endDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              End Date
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
              disabled={processing}
            />
          </div>

          {/* Limit */}
          <div>
            <Label htmlFor="limit" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Limit (max 1000)
            </Label>
            <Input
              id="limit"
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              min="1"
              max="1000"
              className="mt-1"
              disabled={processing}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maximum number of records to process
            </p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Ready to Execute
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Review your filters and execute the bulk operation
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={resetFilters} variant="outline" disabled={processing}>
              Reset Filters
            </Button>
            <Button
              onClick={handleExecute}
              disabled={processing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Execute Bulk Operation
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Info Box */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
          Important Notes
        </p>
        <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>Operations are queued and processed asynchronously in the background</li>
          <li>You will see the queued count immediately after execution</li>
          <li>Processing may take several minutes depending on the volume</li>
          <li>All operations are logged for audit purposes</li>
        </ul>
      </Card>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Bulk Operation Failed"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Bulk Operation Queued"
        message={
          result
            ? `${result.message} (${result.queued_count} record${result.queued_count !== 1 ? 's' : ''} queued for processing)`
            : 'Your bulk operation has been queued successfully.'
        }
      />
    </div>
  );
}
