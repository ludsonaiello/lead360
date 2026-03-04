/**
 * Calendar Dashboard Widget Component
 * Dashboard widget showing new and upcoming appointments
 * Auto-refreshes and provides quick acknowledge actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Clock, CheckCircle2, RotateCcw, ArrowRight, MapPin, User, Bell } from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  getDashboardUpcoming,
  getDashboardNew,
  acknowledgeAppointment,
} from '@/lib/api/calendar';
import type {
  DashboardUpcomingResponse,
  DashboardNewAppointmentsResponse,
} from '@/lib/types/calendar';
import toast from 'react-hot-toast';

interface CalendarDashboardWidgetProps {
  autoRefreshInterval?: number;  // milliseconds (default: 30000 = 30 seconds)
  className?: string;
}

export function CalendarDashboardWidget({
  autoRefreshInterval = 30000,
  className = '',
}: CalendarDashboardWidgetProps) {
  const [upcomingAppointments, setUpcomingAppointments] = useState<DashboardUpcomingResponse['items']>([]);
  const [newAppointments, setNewAppointments] = useState<DashboardNewAppointmentsResponse['items']>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Fetch appointments data
  const fetchAppointments = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [upcomingData, newData] = await Promise.all([
        getDashboardUpcoming(5),
        getDashboardNew(10),
      ]);

      setUpcomingAppointments(upcomingData.items);
      setUpcomingCount(upcomingData.count);
      setNewAppointments(newData.items);
      setNewCount(newData.count);
    } catch (error: any) {
      console.error('Failed to fetch calendar appointments:', error);
      toast.error('Could not fetch calendar appointments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAppointments();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(() => {
        fetchAppointments(true);
      }, autoRefreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval]);

  // Manual refresh
  const handleRefresh = () => {
    fetchAppointments(true);
  };

  // Acknowledge appointment
  const handleAcknowledge = async (appointmentId: string) => {
    setAcknowledgingId(appointmentId);
    try {
      await acknowledgeAppointment(appointmentId);
      toast.success('Appointment acknowledged');
      fetchAppointments(true);
    } catch (error: any) {
      console.error('Failed to acknowledge appointment:', error);
      toast.error('Could not acknowledge appointment');
    } finally {
      setAcknowledgingId(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    // Parse YYYY-MM-DD as local date (not UTC) to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Reset time parts for accurate comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Format time for display (convert from "09:00" to "9:00 AM")
  const formatTime = (timeString: string): string => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Format source badge
  const formatSource = (source: string): string => {
    const sourceMap: Record<string, string> = {
      voice_ai: 'Voice AI',
      manual: 'Manual',
      system: 'System',
    };
    return sourceMap[source] || source;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* New Appointments Widget */}
      {newCount > 0 && (
        <Card className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Appointments</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {newCount} appointment{newCount > 1 ? 's' : ''} need{newCount === 1 ? 's' : ''} acknowledgment
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warning" className="px-3 py-1">
                {newCount}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <div className="space-y-3">
              {newAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-4 border-2 border-orange-200 dark:border-orange-700 rounded-lg bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Appointment Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="info" className="text-xs">
                          {formatSource(appointment.source || 'manual')}
                        </Badge>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {formatDate(appointment.scheduled_date)} at {formatTime(appointment.start_time)}
                        </span>
                      </div>
                      <Link
                        href={`/calendar?date=${appointment.scheduled_date}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        {appointment.appointment_type_name}
                      </Link>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {appointment.lead_first_name} {appointment.lead_last_name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAcknowledge(appointment.id)}
                        disabled={acknowledgingId === appointment.id}
                      >
                        {acknowledgingId === appointment.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Acknowledge
                          </>
                        )}
                      </Button>
                      <Link
                        href={`/calendar?date=${appointment.scheduled_date}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        View in Calendar
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Upcoming Appointments Widget */}
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Upcoming Appointments</h3>
              {upcomingCount > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Next {upcomingCount} appointment{upcomingCount > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : upcomingAppointments.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              No upcoming appointments
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Your calendar is clear
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/calendar?date=${appointment.scheduled_date}`}
                className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Appointment Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatDate(appointment.scheduled_date)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-500">•</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                      </span>
                      <Badge
                        variant={appointment.status === 'confirmed' ? 'success' : 'info'}
                        className="text-xs capitalize"
                      >
                        {appointment.status}
                      </Badge>
                    </div>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {appointment.appointment_type_name}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{appointment.lead_first_name} {appointment.lead_last_name}</span>
                      </div>
                      {appointment.address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{appointment.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Arrow Icon */}
                  <div className="flex-shrink-0">
                    <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* View All Link */}
        {upcomingCount > 5 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/calendar"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center justify-center gap-2"
            >
              View full calendar
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

export default CalendarDashboardWidget;
