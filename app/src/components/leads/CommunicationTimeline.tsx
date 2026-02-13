/**
 * Communication Timeline Component
 * Displays unified timeline of SMS, Calls, and Emails for a lead
 * with tabs to filter by communication type
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Phone,
  Mail,
  Loader2,
  Search,
  Filter,
  Calendar,
  Clock,
  PhoneIncoming,
  PhoneOutgoing,
  MessageCircle,
  Send,
  Inbox,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getCommunicationHistory } from '@/lib/api/communication';
import { getCallHistory } from '@/lib/api/twilio-tenant';
import type { CommunicationEvent } from '@/lib/types/communication';
import type { CallRecord } from '@/lib/types/twilio-tenant';
import { CallDetailsModal } from '@/components/twilio/CallDetailsModal';
import { CommunicationEventModal } from './CommunicationEventModal';

interface CommunicationTimelineProps {
  leadId: string;
  className?: string;
}

type TabType = 'all' | 'sms' | 'calls' | 'emails';

type TimelineItem = {
  id: string;
  type: 'sms' | 'call' | 'email';
  direction: 'inbound' | 'outbound';
  timestamp: string;
  status: string;
  preview: string;
  data: CommunicationEvent | CallRecord;
};

export function CommunicationTimeline({ leadId, className = '' }: CommunicationTimelineProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(true);
  const [communicationEvents, setCommunicationEvents] = useState<CommunicationEvent[]>([]);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CommunicationEvent | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadData();
  }, [leadId, activeTab]);

  const loadData = async (pageNum: number = 1) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Fetch each channel separately to ensure we get data from all types
      // (otherwise API pagination might skip some channels if they're less recent)
      const smsPromise = getCommunicationHistory({
        related_entity_type: 'lead',
        related_entity_id: leadId,
        channel: 'sms',
        page: pageNum,
        limit: 20,
      });

      const emailPromise = getCommunicationHistory({
        related_entity_type: 'lead',
        related_entity_id: leadId,
        channel: 'email',
        page: pageNum,
        limit: 20,
      });

      const callCommPromise = getCommunicationHistory({
        related_entity_type: 'lead',
        related_entity_id: leadId,
        channel: 'call',
        page: pageNum,
        limit: 20,
      });

      // Also load call records from separate API
      const callsPromise = getCallHistory({ page: pageNum, limit: 20 });

      const [smsResponse, emailResponse, callCommResponse, callsResponse] = await Promise.all([
        smsPromise,
        emailPromise,
        callCommPromise,
        callsPromise,
      ]);

      // Merge all communication events
      const allComms = [
        ...smsResponse.data,
        ...emailResponse.data,
        ...callCommResponse.data,
      ];

      // Filter calls by lead ID
      const leadCalls = callsResponse.data.filter((call) => call.lead_id === leadId);

      if (pageNum === 1) {
        setCommunicationEvents(allComms);
        setCallRecords(leadCalls);
      } else {
        setCommunicationEvents((prev) => [...prev, ...allComms]);
        setCallRecords((prev) => [...prev, ...leadCalls]);
      }

      // Check if there's more data
      const hasMoreComm = commResponse.meta.page < commResponse.meta.total_pages;
      const hasMoreCalls = callsResponse.meta.page < (callsResponse.meta.totalPages || 0);
      setHasMore(hasMoreComm || hasMoreCalls);
      setPage(pageNum);
    } catch (error: any) {
      console.error('Failed to load communication history:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    loadData(page + 1);
  };

  // Merge and sort timeline items
  const allTimelineItems: TimelineItem[] = React.useMemo(() => {
    const items: TimelineItem[] = [];

    // Create a map of call SIDs from CallRecords for quick lookup
    const callRecordsBySid = new Map<string, CallRecord>();
    callRecords.forEach((call) => {
      callRecordsBySid.set(call.twilio_call_sid, call);
    });

    // Add communication events (SMS, Email, WhatsApp, Calls)
    communicationEvents.forEach((event) => {
      // Determine type based on channel
      let itemType: 'sms' | 'email' | 'call' = 'email'; // Default to email
      if (event.channel === 'call') {
        itemType = 'call';

        // For calls, prefer CallRecord if available (has full details like transcription)
        const matchingCallRecord = event.provider_message_id
          ? callRecordsBySid.get(event.provider_message_id)
          : null;

        if (matchingCallRecord) {
          // Use CallRecord instead of CommunicationEvent (has transcription, etc.)
          items.push({
            id: matchingCallRecord.id,
            type: 'call',
            direction: matchingCallRecord.direction,
            timestamp: matchingCallRecord.created_at,
            status: matchingCallRecord.status,
            preview: matchingCallRecord.call_reason || `${matchingCallRecord.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call - ${matchingCallRecord.status}`,
            data: matchingCallRecord,
          });
          // Mark this call as used so we don't add it again
          callRecordsBySid.delete(event.provider_message_id!);
          return; // Skip adding the CommunicationEvent version
        }
        // If no matching CallRecord, fall through to add CommunicationEvent
      } else if (event.channel === 'sms' || event.channel === 'whatsapp') {
        itemType = 'sms';
      } else if (event.channel === 'email') {
        itemType = 'email';
      }

      items.push({
        id: event.id,
        type: itemType,
        direction: event.direction,
        timestamp: event.created_at,
        status: event.status,
        preview: event.subject || event.text_body?.substring(0, 100) || 'No content',
        data: event,
      });
    });

    // Add remaining call records that weren't matched (orphaned calls)
    callRecordsBySid.forEach((call) => {
      items.push({
        id: call.id,
        type: 'call',
        direction: call.direction,
        timestamp: call.created_at,
        status: call.status,
        preview: call.call_reason || `${call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call - ${call.status}`,
        data: call,
      });
    });

    // Sort by timestamp (newest first)
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return items;
  }, [communicationEvents, callRecords]);

  // Filter timeline items based on active tab
  const timelineItems = React.useMemo(() => {
    if (activeTab === 'all') {
      return allTimelineItems;
    } else if (activeTab === 'sms') {
      return allTimelineItems.filter((item) => item.type === 'sms');
    } else if (activeTab === 'calls') {
      return allTimelineItems.filter((item) => item.type === 'call');
    } else if (activeTab === 'emails') {
      return allTimelineItems.filter((item) => item.type === 'email');
    }
    return allTimelineItems;
  }, [allTimelineItems, activeTab]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return 'success';
      case 'failed':
        return 'danger';
      case 'pending':
      case 'sent':
        return 'info';
      default:
        return 'gray';
    }
  };

  const getIcon = (type: string, direction: string) => {
    if (type === 'call') {
      return direction === 'inbound' ? PhoneIncoming : PhoneOutgoing;
    }
    if (type === 'sms') {
      return direction === 'inbound' ? Inbox : Send;
    }
    return Mail;
  };

  const handleItemClick = (item: TimelineItem) => {
    if (item.type === 'call') {
      // All calls in timeline are now CallRecords (with full details)
      setSelectedCall(item.data as CallRecord);
    } else {
      // SMS and Email events
      setSelectedEvent(item.data as CommunicationEvent);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b-2 border-gray-200 dark:border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-0.5 ${
            activeTab === 'all'
              ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          All ({allTimelineItems.length})
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-0.5 flex items-center gap-2 ${
            activeTab === 'sms'
              ? 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400'
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          SMS ({allTimelineItems.filter((item) => item.type === 'sms').length})
        </button>
        <button
          onClick={() => setActiveTab('calls')}
          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-0.5 flex items-center gap-2 ${
            activeTab === 'calls'
              ? 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400'
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <Phone className="w-4 h-4" />
          Calls ({allTimelineItems.filter((item) => item.type === 'call').length})
        </button>
        <button
          onClick={() => setActiveTab('emails')}
          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-0.5 flex items-center gap-2 ${
            activeTab === 'emails'
              ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <Mail className="w-4 h-4" />
          Emails ({allTimelineItems.filter((item) => item.type === 'email').length})
        </button>
      </div>

      {/* Timeline */}
      {timelineItems.length === 0 ? (
        <div className="text-center py-8">
          <MessageCircle className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            No {activeTab === 'all' ? 'communication' : activeTab} history yet
          </p>
        </div>
      ) : (
        <div className="relative space-y-4">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

          {timelineItems.map((item) => {
            const Icon = getIcon(item.type, item.direction);
            const isCall = item.type === 'call';
            const callData = isCall ? (item.data as CallRecord) : null;
            const hasRecording = callData?.recording_url;
            const hasTranscription = callData?.transcription;

            return (
              <div
                key={item.id}
                className="relative flex gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg p-2 -ml-2 transition-colors"
                onClick={() => handleItemClick(item)}
              >
                {/* Icon */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 ${
                      item.type === 'call'
                        ? item.direction === 'inbound'
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-green-100 dark:bg-green-900/30'
                        : item.type === 'sms'
                        ? item.direction === 'inbound'
                          ? 'bg-purple-100 dark:bg-purple-900/30'
                          : 'bg-pink-100 dark:bg-pink-900/30'
                        : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        item.type === 'call'
                          ? item.direction === 'inbound'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-green-600 dark:text-green-400'
                          : item.type === 'sms'
                          ? item.direction === 'inbound'
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-pink-600 dark:text-pink-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                        {item.direction} {item.type}
                      </span>
                      <Badge color={getStatusBadgeColor(item.status)} size="sm">
                        {item.status}
                      </Badge>
                      {hasRecording && (
                        <Badge color="purple" size="sm">
                          Recording
                        </Badge>
                      )}
                      {hasTranscription && (
                        <Badge color="info" size="sm">
                          Transcription
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-2">
                    {item.preview}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(item.timestamp), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{format(new Date(item.timestamp), 'h:mm a')}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && timelineItems.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="ghost" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Load More
              </>
            )}
          </Button>
        </div>
      )}

      {/* Modals */}
      {selectedCall && (
        <CallDetailsModal
          call={selectedCall}
          isOpen={!!selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}

      {selectedEvent && (
        <CommunicationEventModal
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

export default CommunicationTimeline;
