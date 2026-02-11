/**
 * Call Info Card Component
 * Sprint 4: Transcription Monitoring
 * Displays detailed call information with links to related records
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { TranscriptionDetail } from '@/lib/types/twilio-admin';
import { formatDateTime, formatDuration } from '@/lib/utils/date-formatter';
import { Phone, ArrowDownLeft, ArrowUpRight, ExternalLink, Clock, PlayCircle } from 'lucide-react';

interface CallInfoCardProps {
  transcription: TranscriptionDetail;
}

export function CallInfoCard({ transcription }: CallInfoCardProps) {
  const { call, tenant, lead } = transcription;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          Call Information
        </h3>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Call SID */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Call SID
          </label>
          <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
            {call.twilio_call_sid}
          </div>
        </div>

        {/* Direction */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Direction
          </label>
          <div className="flex items-center gap-2">
            {call.direction === 'inbound' ? (
              <>
                <ArrowDownLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-gray-900 dark:text-gray-100">Inbound</span>
              </>
            ) : (
              <>
                <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-gray-900 dark:text-gray-100">Outbound</span>
              </>
            )}
          </div>
        </div>

        {/* Phone Numbers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              From
            </label>
            <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
              {call.from_number}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              To
            </label>
            <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
              {call.to_number}
            </div>
          </div>
        </div>

        {/* Call Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Duration
            </label>
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {formatDuration(call.recording_duration_seconds)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Started At
            </label>
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {formatDateTime(call.started_at)}
            </div>
          </div>
        </div>

        {/* Recording URL */}
        {call.recording_url && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <PlayCircle className="h-3 w-3" />
              Recording
            </label>
            <a
              href={call.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400
                hover:text-blue-800 dark:hover:text-blue-300 hover:underline
              "
            >
              Listen to Recording
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Tenant Information */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Tenant
          </label>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {tenant.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {tenant.subdomain}.lead360.app
              </div>
            </div>
            <Link
              href={`/admin/tenants/${tenant.id}`}
              className="
                inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium
                text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30
                border border-blue-200 dark:border-blue-800 rounded-md
                hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors
              "
            >
              View Tenant
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Lead Information */}
        {lead && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Lead
            </label>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {lead.first_name} {lead.last_name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {lead.primary_phone}
                </div>
              </div>
              <Link
                href={`/admin/leads/${lead.id}`}
                className="
                  inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium
                  text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30
                  border border-blue-200 dark:border-blue-800 rounded-md
                  hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors
                "
              >
                View Lead
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CallInfoCard;
