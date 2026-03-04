/**
 * AppointmentDetailModal Component
 * Displays full appointment details with actions
 * Sprint 35: appointment_detail_cancel
 */

'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Tag,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type { AppointmentWithRelations } from '@/lib/types/calendar';
import CancelAppointmentModal from './CancelAppointmentModal';
import RescheduleAppointmentModal from './RescheduleAppointmentModal';

// ============================================================================
// Types
// ============================================================================

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentWithRelations | null;
  onAppointmentUpdated?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'confirmed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'completed':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'no_show':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'rescheduled':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'scheduled':
      return <CalendarIcon className="w-4 h-4" />;
    case 'confirmed':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4" />;
    case 'no_show':
      return <AlertCircle className="w-4 h-4" />;
    case 'rescheduled':
      return <CalendarIcon className="w-4 h-4" />;
    case 'in_progress':
      return <Clock className="w-4 h-4" />;
    default:
      return <CalendarIcon className="w-4 h-4" />;
  }
};

const formatStatusLabel = (status: string): string => {
  return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const getSourceLabel = (source: string): string => {
  switch (source) {
    case 'voice_ai':
      return 'Voice AI';
    case 'manual':
      return 'Manual';
    case 'system':
      return 'System';
    default:
      return source;
  }
};

// ============================================================================
// Main Component
// ============================================================================

export default function AppointmentDetailModal({
  isOpen,
  onClose,
  appointment,
  onAppointmentUpdated,
}: AppointmentDetailModalProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  if (!appointment) {
    return null;
  }

  const leadFullName = appointment.lead
    ? `${appointment.lead.first_name} ${appointment.lead.last_name}`
    : 'Unknown';

  const canCancel = ['scheduled', 'confirmed'].includes(appointment.status);
  const canReschedule = ['scheduled', 'confirmed'].includes(appointment.status);

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  const handleCancelSuccess = () => {
    setShowCancelModal(false);
    onAppointmentUpdated?.();
    onClose();
  };

  const handleRescheduleClick = () => {
    setShowRescheduleModal(true);
  };

  const handleRescheduleSuccess = () => {
    setShowRescheduleModal(false);
    onAppointmentUpdated?.();
    onClose();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl" title="Appointment Details">
        <div className="space-y-6">
          {/* Header Section - Status and Type */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {appointment.appointment_type?.name || 'Appointment'}
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(
                    appointment.status
                  )}`}
                >
                  {getStatusIcon(appointment.status)}
                  {formatStatusLabel(appointment.status)}
                </span>
                {appointment.source && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    • {getSourceLabel(appointment.source)}
                  </span>
                )}
              </div>
            </div>
            {appointment.appointment_type && (
              <div className="text-sm text-gray-600 dark:text-gray-400 text-right">
                <div className="font-medium">{appointment.appointment_type.slot_duration_minutes} minutes</div>
              </div>
            )}
          </div>

          {/* Date & Time Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Date</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatDate(appointment.scheduled_date)}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Time</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {appointment.start_time} - {appointment.end_time}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information Section */}
          {appointment.lead && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <User className="w-4 h-4" />
                Customer Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <User className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Name</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {leadFullName}
                    </div>
                  </div>
                </div>
                {appointment.lead.phone && (
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <Phone className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Phone</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {appointment.lead.phone}
                      </div>
                    </div>
                  </div>
                )}
                {appointment.lead.email && (
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Email</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {appointment.lead.email}
                      </div>
                    </div>
                  </div>
                )}
                {appointment.lead.company_name && (
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Company</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {appointment.lead.company_name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Service Request Section */}
          {appointment.service_request && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Service Request
              </h4>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {appointment.service_request.service_type}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Status: {formatStatusLabel(appointment.service_request.status)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assigned User Section */}
          {appointment.assigned_user && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Assignment
              </h4>
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Assigned to</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {appointment.assigned_user.first_name} {appointment.assigned_user.last_name}
                  </div>
                  {appointment.assigned_user.email && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {appointment.assigned_user.email}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes Section */}
          {appointment.notes && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notes
              </h4>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {appointment.notes}
                </p>
              </div>
            </div>
          )}

          {/* Cancellation Info (if cancelled) */}
          {appointment.status === 'cancelled' && appointment.cancellation_reason && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Cancellation Information
              </h4>
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Reason: {formatStatusLabel(appointment.cancellation_reason)}
                </div>
                {appointment.cancellation_notes && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {appointment.cancellation_notes}
                  </p>
                )}
                {appointment.cancelled_at && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Cancelled on {new Date(appointment.cancelled_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata Section */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">Created:</span>{' '}
                {new Date(appointment.created_at).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Last Updated:</span>{' '}
                {new Date(appointment.updated_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            {canReschedule && (
              <Button variant="secondary" onClick={handleRescheduleClick}>
                <CalendarIcon className="w-4 h-4" />
                Reschedule
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" onClick={handleCancelClick}>
                <XCircle className="w-4 h-4" />
                Cancel Appointment
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} className="ml-auto">
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reschedule Appointment Modal */}
      {canReschedule && (
        <RescheduleAppointmentModal
          isOpen={showRescheduleModal}
          onClose={() => setShowRescheduleModal(false)}
          appointment={appointment}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      {/* Cancel Appointment Modal */}
      {canCancel && (
        <CancelAppointmentModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          appointment={appointment}
          onSuccess={handleCancelSuccess}
        />
      )}
    </>
  );
}
