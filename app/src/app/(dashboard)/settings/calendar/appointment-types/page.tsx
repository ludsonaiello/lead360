// ============================================================================
// Appointment Types Settings Page
// ============================================================================
// Configure appointment types and their weekly schedules
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  CalendarDays,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/dashboard/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import AppointmentTypeFormModal from '@/components/calendar/AppointmentTypeFormModal';
import DeleteAppointmentTypeModal from '@/components/calendar/DeleteAppointmentTypeModal';
import WeeklyScheduleGridModal from '@/components/calendar/WeeklyScheduleGridModal';
import * as calendarApi from '@/lib/api/calendar';
import type { AppointmentTypeWithSchedules } from '@/lib/types/calendar';

export default function AppointmentTypesPage() {
  const router = useRouter();
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentTypeWithSchedules[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AppointmentTypeWithSchedules | null>(null);

  useEffect(() => {
    loadAppointmentTypes();
  }, []);

  const loadAppointmentTypes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await calendarApi.getAppointmentTypes({
        sort_by: 'created_at',
        sort_order: 'desc',
      });
      setAppointmentTypes(response.items);
    } catch (err: any) {
      console.error('[AppointmentTypes] Failed to load:', err);
      setError(err.message || 'Failed to load appointment types');
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  };

  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return 'All Day';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
  };

  return (
    <ProtectedRoute requiredPermission="calendar:edit">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <Clock className="w-8 h-8 text-brand-600 dark:text-brand-400" />
              Appointment Types
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Configure appointment types and their availability schedules
            </p>
          </div>

          <Button
            onClick={() => {
              setSelectedType(null);
              setFormModalOpen(true);
            }}
            variant="primary"
            size="md"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Appointment Type
          </Button>
        </div>

        {/* Appointment Types List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-red-600 dark:text-red-400 mb-2">
                <p className="text-lg font-semibold">Error Loading Appointment Types</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
              <Button onClick={loadAppointmentTypes} variant="primary" size="sm" className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : appointmentTypes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Appointment Types
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first appointment type to start scheduling
              </p>
              <Button
                onClick={() => {
                  setSelectedType(null);
                  setFormModalOpen(true);
                }}
                variant="primary"
                size="md"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Appointment Type
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointmentTypes.map((type) => (
              <Card key={type.id}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {type.name}
                          </h3>
                          {type.is_default && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              Default
                            </Badge>
                          )}
                          {type.is_active ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              <div className="flex items-center gap-1">
                                <ToggleRight className="w-4 h-4" />
                                Active
                              </div>
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <ToggleLeft className="w-4 h-4" />
                                Inactive
                              </div>
                            </Badge>
                          )}
                        </div>
                        {type.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {type.description}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedType(type);
                            setFormModalOpen(true);
                          }}
                          variant="secondary"
                          size="sm"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedType(type);
                            setDeleteModalOpen(true);
                          }}
                          variant="danger"
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Settings Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Duration
                        </p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatDuration(type.slot_duration_minutes)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Max Lookahead
                        </p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {type.max_lookahead_weeks} weeks
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Reminders
                        </p>
                        <div className="flex gap-2">
                          {type.reminder_24h_enabled && (
                            <Badge variant="outline" className="text-xs">
                              24h
                            </Badge>
                          )}
                          {type.reminder_1h_enabled && (
                            <Badge variant="outline" className="text-xs">
                              1h
                            </Badge>
                          )}
                          {!type.reminder_24h_enabled && !type.reminder_1h_enabled && (
                            <span className="text-sm text-gray-500">None</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Schedule Preview */}
                    {type.schedules && type.schedules.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CalendarDays className="w-4 h-4 text-gray-500" />
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Weekly Schedule
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {type.schedules
                            .sort((a, b) => a.day_of_week - b.day_of_week)
                            .map((schedule) => (
                              <div
                                key={schedule.id}
                                className={`p-2 rounded-md text-sm ${
                                  schedule.is_available
                                    ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800'
                                    : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                                }`}
                              >
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {getDayName(schedule.day_of_week)}
                                </p>
                                {schedule.is_available ? (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    {schedule.window1_start && schedule.window1_end && (
                                      <div>
                                        {schedule.window1_start} - {schedule.window1_end}
                                      </div>
                                    )}
                                    {schedule.window2_start && schedule.window2_end && (
                                      <div>
                                        {schedule.window2_start} - {schedule.window2_end}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 mt-1">Unavailable</p>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Edit Schedule Button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => {
                          setSelectedType(type);
                          setScheduleModalOpen(true);
                        }}
                        variant="secondary"
                        size="sm"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit Schedule
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Form Modal (Create/Edit) */}
        <AppointmentTypeFormModal
          isOpen={formModalOpen}
          onClose={() => {
            setFormModalOpen(false);
            setSelectedType(null);
          }}
          onSuccess={() => {
            loadAppointmentTypes();
          }}
          appointmentType={selectedType}
        />

        {/* Delete Confirmation Modal */}
        <DeleteAppointmentTypeModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedType(null);
          }}
          onSuccess={() => {
            loadAppointmentTypes();
          }}
          appointmentType={selectedType}
        />

        {/* Weekly Schedule Grid Modal */}
        {selectedType && (
          <WeeklyScheduleGridModal
            isOpen={scheduleModalOpen}
            onClose={() => {
              setScheduleModalOpen(false);
              setSelectedType(null);
            }}
            onSuccess={() => {
              loadAppointmentTypes();
            }}
            appointmentTypeId={selectedType.id}
            appointmentTypeName={selectedType.name}
            currentSchedules={selectedType.schedules || []}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
