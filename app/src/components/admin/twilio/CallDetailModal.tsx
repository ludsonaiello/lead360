/**
 * CallDetailModal Component
 * Detailed view of a single call record
 */

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Phone, User, Building2, Clock, DollarSign, FileAudio, FileText, X, Play, Pause, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { CallRecord } from '@/lib/types/twilio-admin';
import { transcribeCallByCallId } from '@/lib/api/twilio-admin';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [retryingTranscription, setRetryingTranscription] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrySuccess, setRetrySuccess] = useState(false);

  if (!call) return null;

  const handlePlayPause = () => {
    if (!audioElement) return;
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleMuteToggle = () => {
    if (!audioElement) return;
    audioElement.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (audioElement) {
      setCurrentTime(audioElement.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioElement) {
      setDuration(audioElement.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioElement) return;
    const newTime = Number(e.target.value);
    audioElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (!audioElement) return;
    audioElement.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRetryTranscription = async () => {
    if (!call.id) return;

    try {
      setRetryingTranscription(true);
      setRetryError(null);
      setRetrySuccess(false);

      // Use the call-based endpoint which works for both first-time and retries
      const reason = !call.transcription
        ? 'Manual transcription request (no previous transcription)'
        : call.transcription.status === 'failed' || call.transcription.status === 'error'
        ? `Retry after ${call.transcription.status} status`
        : 'Manual retry request';

      await transcribeCallByCallId(call.id, reason);
      setRetrySuccess(true);
      // Show success message for 3 seconds
      setTimeout(() => setRetrySuccess(false), 3000);
    } catch (error: any) {
      console.error('Error retrying transcription:', error);
      setRetryError(error.response?.data?.message || 'Failed to retry transcription');
    } finally {
      setRetryingTranscription(false);
    }
  };

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
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Phone:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatPhone(call.from_number)}
                </span>
              </div>
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

            {/* Audio Element (Hidden) */}
            <audio
              ref={setAudioElement}
              src={call.recording_url}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
            />

            {/* Custom Audio Player */}
            <div className="space-y-3">
              {/* Play/Pause & Volume Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayPause}
                  className="p-2 bg-white dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>

                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <button
                  onClick={handleMuteToggle}
                  className="p-2 bg-white dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>

              {/* Playback Speed Controls */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Speed:</span>
                <div className="flex items-center gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handlePlaybackRateChange(rate)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        playbackRate === rate
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                Status: {call.recording_status}
              </div>
            </div>
          </div>
        )}

        {/* Transcription */}
        {(call.transcription || call.recording_url) && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <FileText className="h-4 w-4" />
                Transcription
              </h3>
              {/* Show Try Again button when transcription failed or not available */}
              {(!call.transcription || call.transcription.status === 'failed' || call.transcription.status === 'error') && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRetryTranscription}
                  disabled={retryingTranscription}
                >
                  {retryingTranscription ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Try Again
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {/* Success Message */}
              {retrySuccess && (
                <div className="p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-md text-sm text-green-800 dark:text-green-200">
                  Transcription retry initiated successfully. The transcription will be processed shortly.
                </div>
              )}

              {/* Error Message */}
              {retryError && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-sm text-red-800 dark:text-red-200">
                  {retryError}
                </div>
              )}

              {/* No Transcription Available */}
              {!call.transcription && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Transcription not available for this call.
                </div>
              )}

              {/* Failed Transcription */}
              {call.transcription && (call.transcription.status === 'failed' || call.transcription.status === 'error') && (
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
                  Transcription failed. Click "Try Again" to retry.
                </div>
              )}

              {/* Transcription Text */}
              {call.transcription?.transcription_text && call.transcription.status === 'completed' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {call.transcription.transcription_text}
                  </p>
                </div>
              )}

              {/* Metadata Grid */}
              {call.transcription && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`font-medium ${
                      call.transcription.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                      call.transcription.status === 'failed' || call.transcription.status === 'error' ? 'text-red-600 dark:text-red-400' :
                      call.transcription.status === 'processing' ? 'text-blue-600 dark:text-blue-400' :
                      'text-gray-900 dark:text-gray-100'
                    }`}>
                      {call.transcription.status.charAt(0).toUpperCase() + call.transcription.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Provider:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {call.transcription.transcription_provider.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {call.transcription.language_detected && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Language:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {call.transcription.language_detected.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {call.transcription.confidence_score && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {(parseFloat(call.transcription.confidence_score) * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
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
