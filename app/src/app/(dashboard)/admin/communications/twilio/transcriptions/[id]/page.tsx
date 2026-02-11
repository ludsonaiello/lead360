/**
 * Transcription Detail Page
 * Sprint 4: Transcription Monitoring
 * Detailed view of a single transcription with full context
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { TranscriptionDetailCard } from '@/components/admin/twilio/TranscriptionDetailCard';
import { TranscriptionTextDisplay } from '@/components/admin/twilio/TranscriptionTextDisplay';
import { CallInfoCard } from '@/components/admin/twilio/CallInfoCard';
import { ConfidenceScoreGauge } from '@/components/admin/twilio/ConfidenceScoreGauge';
import { RetryTranscriptionButton } from '@/components/admin/twilio/RetryTranscriptionButton';
import { getTranscriptionDetails } from '@/lib/api/twilio-admin';
import type { TranscriptionDetail } from '@/lib/types/twilio-admin';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function TranscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const transcriptionId = params.id as string;

  const [transcription, setTranscription] = useState<TranscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load transcription details
  const loadTranscription = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getTranscriptionDetails(transcriptionId);
      setTranscription(data);
    } catch (err: any) {
      console.error('[TranscriptionDetailPage] Error loading transcription:', err);
      setError(err?.response?.data?.message || 'Failed to load transcription details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (transcriptionId) {
      loadTranscription();
    }
  }, [transcriptionId]);

  const handleRetrySuccess = () => {
    // Reload transcription data after retry
    loadTranscription();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading transcription details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
              Error Loading Transcription
            </h3>
          </div>
          <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={loadTranscription}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => router.push('/admin/communications/twilio/transcriptions')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!transcription) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Back Button */}
      <div>
        <Link
          href="/admin/communications/twilio/transcriptions"
          className="
            inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400
            hover:text-blue-800 dark:hover:text-blue-300 font-medium
          "
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transcriptions
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Transcription Details
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            View complete transcription information and processing details
          </p>
        </div>
        {transcription.status === 'failed' && (
          <RetryTranscriptionButton
            transcriptionId={transcription.id}
            onSuccess={handleRetrySuccess}
            size="md"
            variant="primary"
          />
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Transcription Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transcription Text */}
          <TranscriptionTextDisplay
            text={transcription.transcription_text}
            errorMessage={transcription.error_message}
            status={transcription.status}
          />

          {/* Processing Details */}
          <TranscriptionDetailCard transcription={transcription} />
        </div>

        {/* Right Column - Related Information */}
        <div className="space-y-6">
          {/* Confidence Score (if available) */}
          {transcription.confidence_score && transcription.status === 'completed' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <ConfidenceScoreGauge score={transcription.confidence_score} size="md" />
            </div>
          )}

          {/* Call Information */}
          <CallInfoCard transcription={transcription} />
        </div>
      </div>
    </div>
  );
}
