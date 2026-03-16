/**
 * Call Details Modal Component
 * Displays comprehensive call information with recording playback
 *
 * Features:
 * - All call details (SID, direction, status, type, etc.)
 * - Lead information with link
 * - User information (who initiated outbound calls)
 * - HTML5 audio player for recordings
 * - Transcription status
 * - Timestamps and duration calculation
 * - Dark mode support
 */

'use client';

import React, { useState, useEffect } from 'react';
import { format, differenceInSeconds } from 'date-fns';
import {
  X,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  User,
  Clock,
  Calendar,
  Play,
  Pause,
  Volume2,
  VolumeX,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';

import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

import { getCallRecording, getCallTranscription, transcribeCallByCallId } from '@/lib/api/twilio-tenant';
import { buildFileUrl } from '@/lib/api/files';
import type { CallRecord, CallRecordingResponse, CallTranscriptionResponse } from '@/lib/types/twilio-tenant';

interface CallDetailsModalProps {
  call: CallRecord;
  isOpen: boolean;
  onClose: () => void;
}

// Helper functions (duplicated from page for component independence)
function formatCallStatus(status: string): string {
  const statusMap: Record<string, string> = {
    initiated: 'Initiated',
    ringing: 'Ringing',
    in_progress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    no_answer: 'No Answer',
    busy: 'Busy',
    canceled: 'Canceled',
  };
  return statusMap[status] || status;
}

function getCallStatusVariant(status: string): 'success' | 'danger' | 'warning' | 'orange' | 'gray' | 'info' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'no_answer':
      return 'warning';
    case 'busy':
      return 'orange';
    case 'canceled':
      return 'gray';
    default:
      return 'info';
  }
}

function formatCallDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getLeadFullName(lead: CallRecord['lead']): string {
  if (!lead) return 'Unknown';
  return `${lead.first_name} ${lead.last_name}`.trim() || 'Unknown';
}

function getUserFullName(user: CallRecord['initiated_by_user']): string {
  if (!user) return 'System';
  return `${user.first_name} ${user.last_name}`.trim() || 'System';
}

export function CallDetailsModal({ call, isOpen, onClose }: CallDetailsModalProps) {
  const [recording, setRecording] = useState<CallRecordingResponse | null>(null);
  const [loadingRecording, setLoadingRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Transcription state
  const [transcription, setTranscription] = useState<CallTranscriptionResponse | null>(null);
  const [loadingTranscription, setLoadingTranscription] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [retryingTranscription, setRetryingTranscription] = useState(false);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Fetch recording data when modal opens
  useEffect(() => {
    if (isOpen) {
      // Always fetch recording data to get the latest status
      fetchRecording();
    }

    return () => {
      // Cleanup audio on unmount
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [isOpen, call.id]);

  const fetchRecording = async () => {
    try {
      setLoadingRecording(true);
      setRecordingError(null);
      const data = await getCallRecording(call.id);
      setRecording(data);

      // If transcription is available, fetch it
      if (data.transcription_available) {
        fetchTranscription();
      }
    } catch (error: any) {
      console.error('Error fetching recording:', error);
      setRecordingError('Failed to load recording');
    } finally {
      setLoadingRecording(false);
    }
  };

  const fetchTranscription = async () => {
    try {
      setLoadingTranscription(true);
      setTranscriptionError(null);
      const data = await getCallTranscription(call.id);
      setTranscription(data);
    } catch (error: any) {
      console.error('Error fetching transcription:', error);
      setTranscriptionError('Failed to load transcription');
    } finally {
      setLoadingTranscription(false);
    }
  };

  const handleRetryTranscription = async () => {
    if (!call.id) return;

    try {
      setRetryingTranscription(true);
      setTranscriptionError(null);

      // Use the call-based endpoint which works for both first-time and retries
      const reason = transcriptionError
        ? 'Retry after previous failure'
        : !recording?.transcription_available
        ? 'Manual transcription request'
        : 'Retry transcription';

      await transcribeCallByCallId(call.id, reason);

      // Refresh recording to get updated transcription status
      await fetchRecording();
    } catch (error: any) {
      console.error('Error retrying transcription:', error);
      setTranscriptionError(error.response?.data?.message || 'Failed to retry transcription');
    } finally {
      setRetryingTranscription(false);
    }
  };

  const getFullRecordingUrl = (url: string): string => {
    return buildFileUrl(url) || url;
  };

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
    setCurrentTime(0);
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

  // Calculate call duration from timestamps
  const callDuration = call.started_at && call.ended_at
    ? differenceInSeconds(new Date(call.ended_at), new Date(call.started_at))
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Call Details" size="xl">
      <div className="space-y-6">
        {/* Header with Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${
              call.direction === 'inbound'
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'bg-purple-100 dark:bg-purple-900'
            }`}>
              {call.direction === 'inbound' ? (
                <PhoneIncoming className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              ) : (
                <PhoneOutgoing className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {call.direction === 'inbound' ? 'Inbound Call' : 'Outbound Call'}
              </h3>
              <Badge color={getCallStatusVariant(call.status)}>
                {formatCallStatus(call.status)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Call Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lead Information */}
          {call.lead && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Lead
              </label>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <Link
                  href={`/leads/${call.lead.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {getLeadFullName(call.lead)}
                </Link>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Phone className="w-4 h-4" />
                {call.from_number}
              </div>
            </div>
          )}

          {/* Initiated By (Outbound Only) */}
          {call.direction === 'outbound' && call.initiated_by_user && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Initiated By
              </label>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">
                  {getUserFullName(call.initiated_by_user)}
                </span>
              </div>
            </div>
          )}

          {/* Call Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Call Type
            </label>
            <div className="text-gray-900 dark:text-white">
              {call.call_type === 'customer_call' && 'Customer Call'}
              {call.call_type === 'office_bypass_call' && 'Office Bypass'}
              {call.call_type === 'ivr_routed_call' && 'IVR Routed'}
            </div>
          </div>

          {/* Twilio Call SID */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Twilio Call SID
            </label>
            <div className="text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
              {call.twilio_call_sid}
            </div>
          </div>

          {/* From Number */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              From Number
            </label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900 dark:text-white">{call.from_number}</span>
            </div>
          </div>

          {/* To Number */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              To Number
            </label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900 dark:text-white">{call.to_number}</span>
            </div>
          </div>

          {/* Created At */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Created
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900 dark:text-white">
                {format(new Date(call.created_at), 'MMM d, yyyy h:mm:ss a')}
              </span>
            </div>
          </div>

          {/* Started At */}
          {call.started_at && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Started
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(call.started_at), 'MMM d, yyyy h:mm:ss a')}
                </span>
              </div>
            </div>
          )}

          {/* Ended At */}
          {call.ended_at && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ended
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(call.ended_at), 'MMM d, yyyy h:mm:ss a')}
                </span>
              </div>
            </div>
          )}

          {/* Duration */}
          {callDuration !== null && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Duration
              </label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">
                  {formatCallDuration(callDuration)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Call Reason */}
        {call.call_reason && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Call Reason
            </label>
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-gray-400 mt-1" />
              <p className="text-gray-900 dark:text-white">{call.call_reason}</p>
            </div>
          </div>
        )}

        {/* Recording Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
            Call Recording
          </h4>

          {loadingRecording ? (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <LoadingSpinner size="sm" />
              <span>Loading recording...</span>
            </div>
          ) : recordingError ? (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <AlertCircle className="w-4 h-4" />
              <span>No recording available for this call</span>
            </div>
          ) : recording ? (
                <div className="space-y-4">
                  {/* Audio Element (Hidden) */}
                  <audio
                    ref={setAudioElement}
                    src={getFullRecordingUrl(recording.url)}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleEnded}
                    className="hidden"
                  />

                  {/* Custom Audio Player UI */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                    {/* Play/Pause and Duration */}
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handlePlayPause}
                        variant="primary"
                        size="sm"
                        className="w-10 h-10 rounded-full p-0 flex items-center justify-center"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </Button>

                      <div className="flex-1 space-y-1">
                        {/* Progress Bar */}
                        <input
                          type="range"
                          min="0"
                          max={duration || 0}
                          value={currentTime}
                          onChange={handleSeek}
                          className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                              (currentTime / (duration || 1)) * 100
                            }%, #d1d5db ${(currentTime / (duration || 1)) * 100}%, #d1d5db 100%)`,
                          }}
                        />

                        {/* Time Display */}
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>{formatCallDuration(Math.floor(currentTime))}</span>
                          <span>{formatCallDuration(Math.floor(duration))}</span>
                        </div>
                      </div>

                      {/* Mute Button */}
                      <Button
                        onClick={handleMuteToggle}
                        variant="ghost"
                        size="sm"
                        className="w-10 h-10 rounded-full p-0 flex items-center justify-center"
                      >
                        {isMuted ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </Button>
                    </div>

                    {/* Playback Speed and Recording Info */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
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
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                              }`}
                            >
                              {rate}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Recording Info */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>Duration: {formatCallDuration(recording.duration_seconds)}</span>
                        {recording.transcription_available && (
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Transcription
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
          ) : null}

          {/* Transcription Section */}
          {(recording?.transcription_available || recording?.url) && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Call Transcription
                  </h4>
                </div>
                {/* Show Try Again button when transcription failed or not available */}
                {(transcriptionError || !recording?.transcription_available || transcription?.status === 'failed') && (
                  <Button
                    onClick={handleRetryTranscription}
                    variant="secondary"
                    size="sm"
                    disabled={retryingTranscription}
                  >
                    {retryingTranscription ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Retrying...
                      </>
                    ) : (
                      'Try Again'
                    )}
                  </Button>
                )}
              </div>

              {loadingTranscription ? (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <LoadingSpinner size="sm" />
                  <span>Loading transcription...</span>
                </div>
              ) : transcriptionError ? (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{transcriptionError}</span>
                </div>
              ) : !recording?.transcription_available ? (
                <div className="flex items-start gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Transcription not available for this call</span>
                </div>
              ) : transcription ? (
                <div className="space-y-3">
                  {/* Status Badge */}
                  {transcription.status === 'failed' && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <XCircle className="w-4 h-4" />
                      <span>Transcription failed</span>
                    </div>
                  )}

                  {/* Transcription Text */}
                  {transcription.transcription_text && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {transcription.transcription_text}
                      </p>
                    </div>
                  )}

                  {/* Transcription Metadata */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      <Badge
                        color={
                          transcription.status === 'completed' ? 'success' :
                          transcription.status === 'failed' ? 'danger' :
                          'gray'
                        }
                        className="ml-1"
                      >
                        {transcription.status}
                      </Badge>
                    </div>
                    {transcription.language_detected && (
                      <div>
                        <span className="font-medium">Language:</span>{' '}
                        {transcription.language_detected.toUpperCase()}
                      </div>
                    )}
                    {transcription.confidence_score !== null && (
                      <div>
                        <span className="font-medium">Confidence:</span>{' '}
                        {(transcription.confidence_score * 100).toFixed(0)}%
                      </div>
                    )}
                    {transcription.transcription_provider && (
                      <div>
                        <span className="font-medium">Provider:</span>{' '}
                        {transcription.transcription_provider.replace(/_/g, ' ')}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
