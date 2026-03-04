// ============================================================================
// Calendar Page - Main Scheduling View
// ============================================================================
// Displays appointments in list view with filters and CRUD operations
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Clock,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  List,
  CalendarDays,
} from 'lucide-react';
import { Card, CardContent } from '@/components/dashboard/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import WeekViewCalendar from '@/components/calendar/WeekViewCalendar';
import DayViewCalendar from '@/components/calendar/DayViewCalendar';
import CreateAppointmentModal from '@/components/calendar/CreateAppointmentModal';
import AppointmentDetailModal from '@/components/calendar/AppointmentDetailModal';
import RescheduleAppointmentModal from '@/components/calendar/RescheduleAppointmentModal';
import * as calendarApi from '@/lib/api/calendar';
import type {
  AppointmentWithRelations,
  AppointmentStatus,
  ExternalBlock,
  AppointmentTypeSchedule
} from '@/lib/types/calendar';

type CalendarView = 'list' | 'week' | 'day';

export default function CalendarPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [externalBlocks, setExternalBlocks] = useState<ExternalBlock[]>([]);
  const [schedule, setSchedule] = useState<AppointmentTypeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all' | 'active'>('active');
  const [view, setView] = useState<CalendarView>('week');
  const [showInactive, setShowInactive] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day; // Get Sunday of current week
    return new Date(today.setDate(diff));
  });
  const [currentDay, setCurrentDay] = useState<Date>(() => new Date());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<AppointmentWithRelations | null>(null);

  // Load appointments
  useEffect(() => {
    loadAppointments();
  }, [statusFilter, view, currentWeekStart, currentDay, showInactive]);

  const loadAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        limit: view === 'list' ? 50 : 200, // More appointments for calendar views
        sort_by: 'scheduled_date',
        sort_order: 'asc',
      };

      // For calendar views (week/day), only show active appointments by default
      // unless user explicitly toggles to show inactive ones
      if (view === 'week' || view === 'day') {
        if (!showInactive) {
          // Filter client-side for active appointments only
          // (scheduled and confirmed - the ones that can be rescheduled)
        } else {
          // Show all appointments when toggle is enabled
        }
      } else {
        // For list view, apply status filter
        if (statusFilter === 'active') {
          // Will be filtered client-side to show only scheduled and confirmed
        } else if (statusFilter !== 'all') {
          params.status = statusFilter;
        }
      }

      let dateFrom = '';
      let dateTo = '';

      // For week view, filter by date range
      if (view === 'week') {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        dateFrom = currentWeekStart.toISOString().split('T')[0];
        dateTo = weekEnd.toISOString().split('T')[0];
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }

      // For day view, filter by single date
      if (view === 'day') {
        dateFrom = currentDay.toISOString().split('T')[0];
        dateTo = dateFrom;
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }

      // Load appointments, external blocks, and schedule in parallel
      const [appointmentsRes, externalBlocksRes, appointmentTypesRes] = await Promise.all([
        calendarApi.getAppointments(params),
        view !== 'list' && dateFrom && dateTo
          ? calendarApi.getExternalBlocks({ date_from: dateFrom, date_to: dateTo })
          : Promise.resolve({ data: [], total_blocks: 0, date_range: { from: '', to: '' } }),
        view !== 'list'
          ? calendarApi.getAppointmentTypes({ is_default: true, limit: 1 })
              .then(async (types) => {
                if (types.items.length > 0) {
                  return calendarApi.getAppointmentTypeSchedule(types.items[0].id);
                }
                return [];
              })
              .catch(() => [] as AppointmentTypeSchedule[])
          : Promise.resolve([] as AppointmentTypeSchedule[]),
      ]);

      // Filter appointments based on view and settings
      let filteredAppointments = appointmentsRes.items;

      // For calendar views (week/day), filter out inactive appointments unless user wants to see them
      if (view === 'week' || view === 'day') {
        if (!showInactive) {
          // Only show active appointments (scheduled and confirmed)
          filteredAppointments = appointmentsRes.items.filter(
            (apt) => apt.status === 'scheduled' || apt.status === 'confirmed'
          );
        }
      } else if (view === 'list' && statusFilter === 'active') {
        // For list view with 'active' filter, show only scheduled and confirmed
        filteredAppointments = appointmentsRes.items.filter(
          (apt) => apt.status === 'scheduled' || apt.status === 'confirmed'
        );
      }

      setAppointments(filteredAppointments);
      setExternalBlocks(externalBlocksRes.data);
      setSchedule(appointmentTypesRes);
    } catch (err: any) {
      console.error('[Calendar] Failed to load calendar data:', err);
      setError(err.message || 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  // Week navigation handlers
  const handleNavigatePrevious = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  };

  const handleNavigateNext = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  };

  const handleNavigateToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    const sundayOfWeek = new Date(today.setDate(diff));
    setCurrentWeekStart(sundayOfWeek);
  };

  // Day view navigation handlers
  const handleDayNavigatePrevious = () => {
    const newDay = new Date(currentDay);
    newDay.setDate(newDay.getDate() - 1);
    setCurrentDay(newDay);
  };

  const handleDayNavigateNext = () => {
    const newDay = new Date(currentDay);
    newDay.setDate(newDay.getDate() + 1);
    setCurrentDay(newDay);
  };

  const handleDayNavigateToday = () => {
    setCurrentDay(new Date());
  };

  const handleAppointmentClick = (appointment: AppointmentWithRelations) => {
    setSelectedAppointment(appointment);
    setIsDetailModalOpen(true);
  };

  const handleDetailModalClose = () => {
    setIsDetailModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleAppointmentUpdated = () => {
    // Reload appointments after update (cancel, confirm, etc.)
    loadAppointments();
  };

  const handleCreateAppointment = () => {
    setIsCreateModalOpen(true);
  };

  const handleModalSuccess = (_appointmentId: string) => {
    // Reload appointments after successful creation
    loadAppointments();
  };

  const handleRescheduleClick = (appointment: AppointmentWithRelations) => {
    setRescheduleAppointment(appointment);
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleModalClose = () => {
    setIsRescheduleModalOpen(false);
    setRescheduleAppointment(null);
  };

  const handleRescheduleSuccess = () => {
    // Reload appointments after successful reschedule
    loadAppointments();
  };

  const getStatusColor = (status: AppointmentStatus): string => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'confirmed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'no_show':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'rescheduled':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled':
      case 'no_show':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    return time; // Already in HH:mm format
  };

  return (
    <ProtectedRoute requiredPermission="calendar:view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <CalendarIcon className="w-8 h-8 text-brand-600 dark:text-brand-400" />
              Calendar & Appointments
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your appointment schedule
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* View Switcher */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  view === 'list'
                    ? 'bg-white dark:bg-gray-600 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
              <button
                onClick={() => setView('day')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  view === 'day'
                    ? 'bg-white dark:bg-gray-600 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                Day
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  view === 'week'
                    ? 'bg-white dark:bg-gray-600 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Week
              </button>
            </div>

            <Button
              onClick={() => router.push('/settings/calendar/appointment-types')}
              variant="secondary"
              size="md"
            >
              <Clock className="w-4 h-4 mr-2" />
              Types
            </Button>
            <Button
              onClick={() => router.push('/settings/calendar/integration')}
              variant="secondary"
              size="md"
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Integration
            </Button>
            <Button onClick={handleCreateAppointment} variant="primary" size="md">
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <Filter className="w-5 h-5 text-gray-500" />

                {view === 'list' ? (
                  <>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Filter by status:
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 'active', label: 'Active' },
                        { value: 'all', label: 'All' },
                        { value: 'scheduled', label: 'Scheduled' },
                        { value: 'confirmed', label: 'Confirmed' },
                        { value: 'completed', label: 'Completed' },
                        { value: 'cancelled', label: 'Cancelled' },
                        { value: 'rescheduled', label: 'Rescheduled' },
                        { value: 'no_show', label: 'No Show' },
                      ].map((filter) => (
                        <button
                          key={filter.value}
                          onClick={() => setStatusFilter(filter.value as any)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            statusFilter === filter.value
                              ? 'bg-brand-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Show inactive appointments (cancelled, rescheduled, completed):
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {showInactive ? 'Showing all' : 'Active only'}
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day View */}
        {view === 'day' && (
          <>
            {error ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-red-600 dark:text-red-400 mb-2">
                    <XCircle className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-lg font-semibold">Error Loading Appointments</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                  <Button onClick={loadAppointments} variant="primary" size="sm" className="mt-4">
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <DayViewCalendar
                appointments={appointments}
                currentDate={currentDay}
                externalBlocks={externalBlocks}
                schedule={schedule}
                onNavigatePrevious={handleDayNavigatePrevious}
                onNavigateNext={handleDayNavigateNext}
                onNavigateToday={handleDayNavigateToday}
                onAppointmentClick={handleAppointmentClick}
                loading={loading}
              />
            )}
          </>
        )}

        {/* Week View */}
        {view === 'week' && (
          <>
            {error ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-red-600 dark:text-red-400 mb-2">
                    <XCircle className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-lg font-semibold">Error Loading Appointments</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                  <Button onClick={loadAppointments} variant="primary" size="sm" className="mt-4">
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <WeekViewCalendar
                appointments={appointments}
                currentWeekStart={currentWeekStart}
                externalBlocks={externalBlocks}
                schedule={schedule}
                onNavigatePrevious={handleNavigatePrevious}
                onNavigateNext={handleNavigateNext}
                onNavigateToday={handleNavigateToday}
                onAppointmentClick={handleAppointmentClick}
                loading={loading}
              />
            )}
          </>
        )}

        {/* List View (Appointments List) */}
        {view === 'list' && (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-red-600 dark:text-red-400 mb-2">
                <XCircle className="w-12 h-12 mx-auto mb-2" />
                <p className="text-lg font-semibold">Error Loading Appointments</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
              <Button onClick={loadAppointments} variant="primary" size="sm" className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : appointments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Appointments Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {statusFilter === 'all'
                  ? 'Get started by creating your first appointment'
                  : `No ${statusFilter} appointments found`}
              </p>
              <Button onClick={handleCreateAppointment} variant="primary" size="md">
                <Plus className="w-4 h-4 mr-2" />
                Create Appointment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Left: Appointment Details */}
                    <div className="flex-1 space-y-3">
                      {/* Header Row */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {appointment.appointment_type?.name || 'Appointment'}
                            </h3>
                            <Badge className={getStatusColor(appointment.status)}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(appointment.status)}
                                <span className="capitalize">{appointment.status.replace('_', ' ')}</span>
                              </div>
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">{formatDate(appointment.scheduled_date)}</span>
                            <span>•</span>
                            <span>
                              {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Customer Info */}
                      {appointment.lead && (
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <User className="w-4 h-4 text-gray-500" />
                            <span>
                              {appointment.lead.first_name} {appointment.lead.last_name}
                            </span>
                          </div>
                          {appointment.lead.phone && (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Phone className="w-4 h-4 text-gray-500" />
                              <span>{appointment.lead.phone}</span>
                            </div>
                          )}
                          {appointment.lead.company_name && (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              <span>{appointment.lead.company_name}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {appointment.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          {appointment.notes}
                        </p>
                      )}

                      {/* Source Badge */}
                      <div>
                        <Badge variant="neutral" className="text-xs">
                          {appointment.source === 'voice_ai' ? '🤖 Voice AI' : '✍️ Manual'}
                        </Badge>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex lg:flex-col gap-2">
                      <Button
                        onClick={() => handleAppointmentClick(appointment)}
                        variant="secondary"
                        size="sm"
                        className="flex-1 lg:flex-none"
                      >
                        View Details
                      </Button>
                      {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
                        <>
                          <Button
                            onClick={() => handleRescheduleClick(appointment)}
                            variant="secondary"
                            size="sm"
                            className="flex-1 lg:flex-none"
                          >
                            Reschedule
                          </Button>
                          <Button
                            onClick={() => handleAppointmentClick(appointment)}
                            variant="danger"
                            size="sm"
                            className="flex-1 lg:flex-none"
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
        )}

        {/* Create Appointment Modal */}
        <CreateAppointmentModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleModalSuccess}
        />

        {/* Appointment Detail Modal */}
        <AppointmentDetailModal
          isOpen={isDetailModalOpen}
          onClose={handleDetailModalClose}
          appointment={selectedAppointment}
          onAppointmentUpdated={handleAppointmentUpdated}
        />

        {/* Reschedule Appointment Modal */}
        {rescheduleAppointment && (
          <RescheduleAppointmentModal
            isOpen={isRescheduleModalOpen}
            onClose={handleRescheduleModalClose}
            appointment={rescheduleAppointment}
            onSuccess={handleRescheduleSuccess}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
