'use client';

// ============================================================================
// CallDetailModal Component
// ============================================================================
// Modal for displaying full call details including transcript
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Phone,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import { CallStatusBadge } from './CallStatusBadge';
import { CallOutcomeBadge } from './CallOutcomeBadge';
import * as voiceAiApi from '@/lib/api/voice-ai';
import type { CallLog } from '@/lib/types/voice-ai';
import { formatDistanceToNow } from 'date-fns';

interface CallDetailModalProps {
  callLogId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface TranscriptEntry {
  timestamp: string;
  speaker: 'agent' | 'user';
  text: string;
}

interface ActionEntry {
  type: string;
  lead_id?: string;
  lead_name?: string;
  number?: string;
  timestamp?: string;
  [key: string]: any;
}

/**
 * CallDetailModal - Full call details with transcript
 */
export function CallDetailModal({ callLogId, isOpen, onClose }: CallDetailModalProps) {
  const [callLog, setCallLog] = useState<CallLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load call log details
   */
  const loadCallLog = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await voiceAiApi.getTenantCallLogById(callLogId);
      setCallLog(data);
    } catch (err: any) {
      console.error('[CallDetailModal] Failed to load call log:', err);
      const errorMessage =
        err.response?.data?.message || 'Failed to load call log details';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and when callLogId changes
  useEffect(() => {
    if (isOpen && callLogId) {
      loadCallLog();
    }
  }, [isOpen, callLogId]);

  /**
   * Parse full transcript from JSON string
   */
  const parseTranscript = (transcriptJson: string | null): TranscriptEntry[] => {
    if (!transcriptJson) return [];

    try {
      return JSON.parse(transcriptJson);
    } catch (err) {
      console.error('[CallDetailModal] Failed to parse transcript:', err);
      return [];
    }
  };

  /**
   * Parse actions from JSON string
   */
  const parseActions = (actionsJson: string | null): ActionEntry[] => {
    if (!actionsJson) return [];

    try {
      return JSON.parse(actionsJson);
    } catch (err) {
      console.error('[CallDetailModal] Failed to parse actions:', err);
      return [];
    }
  };

  /**
   * Format duration in seconds to human-readable format
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  /**
   * Format timestamp for transcript
   */
  const formatTranscriptTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  /**
   * Render action item
   */
  const renderAction = (action: ActionEntry, index: number) => {
    switch (action.type) {
      case 'lead_created':
        return (
          <div key={index} className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                Lead created: <strong>{action.lead_name || 'Unknown'}</strong>
              </span>
              {action.lead_id && (
                <a
                  href={`/leads/${action.lead_id}`}
                  className="ml-2 text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  View Lead
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        );

      case 'transferred':
        return (
          <div key={index} className="flex items-start gap-2">
            <Phone className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-900 dark:text-gray-100">
              Transferred to: <strong>{action.number || 'Unknown'}</strong>
            </span>
          </div>
        );

      case 'email_sent':
        return (
          <div key={index} className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-900 dark:text-gray-100">
              Email sent to customer
            </span>
          </div>
        );

      case 'appointment_scheduled':
        return (
          <div key={index} className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-900 dark:text-gray-100">
              Appointment scheduled
            </span>
          </div>
        );

      default:
        return (
          <div key={index} className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {action.type}: {JSON.stringify(action)}
            </span>
          </div>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        callLog
          ? `Call Details - ${new Date(callLog.started_at).toLocaleString()}`
          : 'Call Details'
      }
      size="xl"
    >
      <ModalContent>
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-1">
                  Failed to Load Call Details
                </h3>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Call Details */}
        {callLog && !loading && (
          <div className="space-y-6">
            {/* Call Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                Call Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Call SID</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-gray-100 mt-1">
                    {callLog.call_sid}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Direction</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 capitalize">
                    {callLog.direction}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">From</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-gray-100 mt-1">
                    {callLog.from_number}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">To</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-gray-100 mt-1">
                    {callLog.to_number}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                  <div className="mt-1">
                    <CallStatusBadge status={callLog.status} />
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Outcome</p>
                  <div className="mt-1">
                    {callLog.outcome ? (
                      <CallOutcomeBadge outcome={callLog.outcome} />
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        None
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {formatDuration(callLog.duration_seconds)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Is Overage</p>
                  <div className="mt-1">
                    {callLog.is_overage ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        No
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Transcript Summary */}
            {callLog.transcript_summary && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                  Transcript Summary
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {callLog.transcript_summary}
                </p>
              </div>
            )}

            {/* Full Transcript */}
            {callLog.full_transcript && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                  Full Transcript
                </h3>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                  {parseTranscript(callLog.full_transcript).map((entry, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${
                        entry.speaker === 'agent'
                          ? 'justify-start'
                          : 'justify-end'
                      }`}
                    >
                      <div
                        className={`flex flex-col max-w-[80%] ${
                          entry.speaker === 'agent'
                            ? 'items-start'
                            : 'items-end'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-medium ${
                              entry.speaker === 'agent'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-green-600 dark:text-green-400'
                            }`}
                          >
                            {entry.speaker === 'agent' ? 'Agent' : 'Caller'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTranscriptTime(entry.timestamp)}
                          </span>
                        </div>
                        <div
                          className={`px-4 py-2 rounded-lg text-sm ${
                            entry.speaker === 'agent'
                              ? 'bg-blue-100 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100'
                              : 'bg-green-100 dark:bg-green-900/20 text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {entry.text}
                        </div>
                      </div>
                    </div>
                  ))}

                  {parseTranscript(callLog.full_transcript).length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No transcript available
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions Taken */}
            {callLog.actions_taken && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                  Actions Taken
                </h3>
                <div className="space-y-3">
                  {parseActions(callLog.actions_taken).map((action, index) =>
                    renderAction(action, index)
                  )}

                  {parseActions(callLog.actions_taken).length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No actions recorded
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalContent>

      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}
