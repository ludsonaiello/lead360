/**
 * CallDetailModal Component
 * Detailed view of a single call record
 */

'use client';

import { format } from 'date-fns';
import { Phone, User, Building2, Clock, DollarSign, FileAudio, FileText, X } from 'lucide-react';
import Link from 'next/link';
import type { CallRecord } from '@/lib/types/twilio-admin';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface CallDetailModalProps {
  isOpen: boolean;
  call: CallRecord | null;
  onClose: () => void;
}

// Helper functions
function formatPhone(phone: string): string {
  if (!phone) return 'N/A';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0s';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatDateTime(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return dateString;
  }
}

function formatCurrency(amount?: string): string {
  if (!amount) return '$0.00';
  return `$${parseFloat(amount).toFixed(2)}`;
}

// Status badge
function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    no_answer: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    busy: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    initiated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    ringing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };

  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

// Detail item component
function DetailItem({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="h-5 w-5 text-gray-400 mt-0.5" />}
      <div className="flex-1">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </div>
        <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">{value}</div>
      </div>
    </div>
  );
}

export function CallDetailModal({ isOpen, call, onClose }: CallDetailModalProps) {
  if (!call) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Call Details</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Call SID: {call.twilio_call_sid}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Status Banner */}
        <div className="mb-6">
          <StatusBadge status={call.status} />
        </div>

        {/* Call Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <DetailItem
            label="Direction"
            value={
              <span
                className={
                  call.direction === 'inbound' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                }
              >
                {call.direction.charAt(0).toUpperCase() + call.direction.slice(1)}
              </span>
            }
            icon={Phone}
          />
          <DetailItem label="Call Type" value={call.call_type || 'N/A'} />
          <DetailItem label="From" value={formatPhone(call.from_number)} />
          <DetailItem label="To" value={formatPhone(call.to_number)} />
          <DetailItem label="Started" value={formatDateTime(call.started_at)} icon={Clock} />
          <DetailItem label="Ended" value={formatDateTime(call.ended_at)} />
          <DetailItem label="Duration" value={formatDuration(call.recording_duration_seconds)} />
          <DetailItem label="Cost" value={formatCurrency(call.cost)} icon={DollarSign} />
        </div>

        {/* Tenant Information */}
        {call.tenant && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              <Building2 className="h-4 w-4" />
              Tenant Information
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Company:</span>
                <Link
                  href={`/admin/tenants/${call.tenant_id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  {call.tenant.company_name}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Subdomain:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {call.tenant.subdomain}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Lead Information */}
        {call.lead && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              <User className="h-4 w-4" />
              Lead Information
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Name:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {call.lead.first_name} {call.lead.last_name}
                </span>
              </div>
              {call.lead.phones && call.lead.phones.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Phone:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatPhone(call.lead.phones.find((p) => p.is_primary)?.phone_number || call.lead.phones[0].phone_number)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recording */}
        {call.recording_url && (
          <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              <FileAudio className="h-4 w-4" />
              Recording
            </h3>
            <audio controls className="w-full">
              <source src={call.recording_url} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Status: {call.recording_status}
            </div>
          </div>
        )}

        {/* Transcription */}
        {call.transcription && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              <FileText className="h-4 w-4" />
              Transcription
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {call.transcription.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Provider:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {call.transcription.transcription_provider}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Metadata</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Created</div>
              <div className="text-gray-900 dark:text-gray-100">{formatDateTime(call.created_at)}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Updated</div>
              <div className="text-gray-900 dark:text-gray-100">{formatDateTime(call.updated_at)}</div>
            </div>
          </div>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}
