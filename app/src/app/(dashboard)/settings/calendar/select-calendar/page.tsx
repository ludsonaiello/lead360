// ============================================================================
// Select Google Calendar Page (OAuth Step 2)
// ============================================================================
// After OAuth authorization, user selects which Google Calendar to connect
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar as CalendarIcon, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/dashboard/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import * as calendarApi from '@/lib/api/calendar';
import type { GoogleCalendar } from '@/lib/types/calendar';

export default function SelectCalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');

  useEffect(() => {
    loadCalendars();
  }, []);

  const loadCalendars = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await calendarApi.listGoogleCalendars();
      setCalendars(response.calendars);

      // Auto-select primary calendar if available
      const primaryCalendar = response.calendars.find((cal) => cal.primary);
      if (primaryCalendar) {
        setSelectedCalendarId(primaryCalendar.id);
      } else if (response.calendars.length > 0) {
        setSelectedCalendarId(response.calendars[0].id);
      }
    } catch (err: any) {
      console.error('[SelectCalendar] Failed to load calendars:', err);

      // Check for specific error types
      if (err.status === 401 || err.message?.includes('Session')) {
        setError(
          'Your Google authorization session expired. Please try connecting again.'
        );
      } else {
        setError(err.message || 'Failed to load Google Calendars');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedCalendarId) {
      setError('Please select a calendar');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const selectedCalendar = calendars.find((cal) => cal.id === selectedCalendarId);

      await calendarApi.connectGoogleCalendar({
        calendarId: selectedCalendarId,
        calendarName: selectedCalendar?.summary || selectedCalendarId,
      });

      // Success! Redirect to integration settings page
      router.push('/settings/calendar/integration?success=true');
    } catch (err: any) {
      console.error('[SelectCalendar] Failed to connect:', err);
      setError(err.message || 'Failed to connect calendar');
      setConnecting(false);
    }
  };

  const handleCancel = () => {
    router.push('/settings/calendar/integration');
  };

  // Handle errors from OAuth redirect (if any)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        access_denied: 'You denied access to your Google Calendar',
        session_expired: 'Your session expired. Please try again',
        invalid_state: 'Invalid session state. Please try again',
        token_exchange_failed: 'Failed to complete authorization. Please try again',
      };
      setError(errorMessages[errorParam] || 'Authorization failed. Please try again');
    }
  }, [searchParams]);

  return (
    <ProtectedRoute requiredPermission="calendar:edit">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-brand-600 dark:text-brand-400" />
            Select Your Google Calendar
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Choose which calendar you want to sync with Lead360
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <LoadingSpinner />
              <p className="text-gray-600 dark:text-gray-400 mt-4">
                Loading your Google Calendars...
              </p>
            </CardContent>
          </Card>
        ) : error ? (
          /* Error State */
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Unable to Load Calendars
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={loadCalendars} variant="secondary" size="md">
                    Try Again
                  </Button>
                  <Button onClick={handleCancel} variant="secondary" size="md">
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : calendars.length === 0 ? (
          /* No Calendars Found */
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  No Calendars Found
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  We couldn't find any calendars in your Google account.
                </p>
                <Button onClick={handleCancel} variant="secondary" size="md">
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Calendar Selection */
          <>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {calendars.map((calendar) => (
                    <button
                      key={calendar.id}
                      onClick={() => setSelectedCalendarId(calendar.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedCalendarId === calendar.id
                          ? 'border-brand-600 dark:border-brand-400 bg-brand-50 dark:bg-brand-900/10'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {calendar.summary}
                            </h3>
                            {calendar.primary && (
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                                Primary
                              </Badge>
                            )}
                          </div>
                          {calendar.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {calendar.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {calendar.timeZone}
                            </span>
                            {calendar.backgroundColor && (
                              <span className="flex items-center gap-1">
                                <span
                                  className="w-3 h-3 rounded-full border border-gray-300"
                                  style={{ backgroundColor: calendar.backgroundColor }}
                                />
                                Color
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          {selectedCalendarId === calendar.id ? (
                            <CheckCircle2 className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                          ) : (
                            <ChevronRight className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <Button onClick={handleCancel} variant="secondary" size="lg" disabled={connecting}>
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                variant="primary"
                size="lg"
                disabled={!selectedCalendarId || connecting}
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect Calendar
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>

            {/* Help Text */}
            <Card>
              <CardContent className="p-4 bg-blue-50 dark:bg-blue-900/10">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Note:</strong> Appointments from Lead360 will appear on the selected
                  calendar, and events from this calendar will block appointment slots in Lead360.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
