// ============================================================================
// AppointmentBlock Component
// ============================================================================
// Reusable appointment display block for calendar views
// Renders appointments as colored blocks with status-based styling
// ============================================================================

'use client';

import React, { useState } from 'react';
import { Clock, User, Phone, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import type { AppointmentWithRelations, AppointmentStatus } from '@/lib/types/calendar';

// ============================================================================
// Types
// ============================================================================

export type AppointmentBlockVariant = 'compact' | 'standard' | 'detailed';

interface AppointmentBlockProps {
  appointment: AppointmentWithRelations;
  variant?: AppointmentBlockVariant;
  onClick?: (appointment: AppointmentWithRelations) => void;
  className?: string;
  style?: React.CSSProperties;
  showTooltip?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getStatusColor = (status: AppointmentStatus): string => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600 focus:ring-blue-500';
    case 'confirmed':
      return 'bg-green-500 border-green-600 text-white hover:bg-green-600 focus:ring-green-500';
    case 'completed':
      return 'bg-gray-500 border-gray-600 text-white hover:bg-gray-600 focus:ring-gray-500';
    case 'cancelled':
      return 'bg-red-500 border-red-600 text-white hover:bg-red-600 focus:ring-red-500';
    case 'no_show':
      return 'bg-orange-500 border-orange-600 text-white hover:bg-orange-600 focus:ring-orange-500';
    case 'rescheduled':
      return 'bg-purple-500 border-purple-600 text-white hover:bg-purple-600 focus:ring-purple-500';
    case 'in_progress':
      return 'bg-yellow-500 border-yellow-600 text-white hover:bg-yellow-600 focus:ring-yellow-500';
    default:
      return 'bg-gray-500 border-gray-600 text-white hover:bg-gray-600 focus:ring-gray-500';
  }
};

const getStatusBadgeColor = (status: AppointmentStatus): string => {
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

const formatStatusLabel = (status: AppointmentStatus): string => {
  return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const getSourceIcon = (source: string): string => {
  switch (source) {
    case 'voice_ai':
      return '🤖';
    case 'manual':
      return '✍️';
    case 'system':
      return '⚙️';
    default:
      return '📅';
  }
};

// ============================================================================
// Main Component
// ============================================================================

export default function AppointmentBlock({
  appointment,
  variant = 'standard',
  onClick,
  className = '',
  style = {},
  showTooltip = true,
}: AppointmentBlockProps) {
  const [showFullTooltip, setShowFullTooltip] = useState(false);

  const leadFullName = appointment.lead
    ? `${appointment.lead.first_name} ${appointment.lead.last_name}`
    : 'Unknown';

  const appointmentTypeName = appointment.appointment_type?.name || 'Appointment';

  // Build ARIA label for accessibility
  const ariaLabel = [
    appointmentTypeName,
    'with',
    leadFullName,
    'on',
    appointment.scheduled_date,
    'from',
    appointment.start_time,
    'to',
    appointment.end_time,
    '-',
    formatStatusLabel(appointment.status),
  ].join(' ');

  const handleClick = () => {
    onClick?.(appointment);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(appointment);
    }
  };

  // ============================================================================
  // Compact Variant (Week View - minimal space)
  // ============================================================================

  if (variant === 'compact') {
    return (
      <div
        role="button"
        tabIndex={onClick ? 0 : -1}
        aria-label={ariaLabel}
        className={`
          absolute left-1 right-1 rounded border-l-4 shadow-sm cursor-pointer transition-all
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${getStatusColor(appointment.status)}
          ${className}
        `}
        style={style}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => showTooltip && setShowFullTooltip(true)}
        onMouseLeave={() => setShowFullTooltip(false)}
      >
        <div className="p-1 h-full overflow-hidden">
          <div className="text-xs font-semibold truncate">{leadFullName}</div>
          <div className="text-xs opacity-90 truncate">{appointmentTypeName}</div>
          <div className="text-xs opacity-80 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {appointment.start_time} - {appointment.end_time}
          </div>
          {appointment.assigned_user && style.height && parseInt(style.height as string) > 60 && (
            <div className="text-xs opacity-80 flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3" />
              {appointment.assigned_user.first_name} {appointment.assigned_user.last_name}
            </div>
          )}
        </div>

        {/* Tooltip */}
        {showTooltip && showFullTooltip && (
          <div
            className="
              absolute left-full top-0 ml-2 z-50 w-72 p-3 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-xl
              pointer-events-none
            "
            role="tooltip"
          >
            <div className="space-y-2">
              <div>
                <div className="text-sm font-bold">{appointmentTypeName}</div>
                <div className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${getStatusBadgeColor(appointment.status)}`}>
                  {formatStatusLabel(appointment.status)}
                </div>
              </div>

              <div className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{leadFullName}</span>
                </div>
                {appointment.lead?.phone && (
                  <div className="flex items-center gap-2 mb-1 text-gray-300 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{appointment.lead.phone}</span>
                  </div>
                )}
                {appointment.lead?.company_name && (
                  <div className="flex items-center gap-2 mb-1 text-gray-300 dark:text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span>{appointment.lead.company_name}</span>
                  </div>
                )}
              </div>

              <div className="text-sm border-t border-gray-700 dark:border-gray-600 pt-2">
                <div className="flex items-center gap-2 text-gray-300 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    {appointment.start_time} - {appointment.end_time}
                  </span>
                </div>
              </div>

              {appointment.assigned_user && (
                <div className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-700 dark:border-gray-600 pt-2">
                  Assigned to: {appointment.assigned_user.first_name} {appointment.assigned_user.last_name}
                </div>
              )}

              {appointment.notes && (
                <div className="text-xs text-gray-300 dark:text-gray-400 border-t border-gray-700 dark:border-gray-600 pt-2 italic">
                  {appointment.notes.substring(0, 100)}
                  {appointment.notes.length > 100 && '...'}
                </div>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-600 border-t border-gray-700 dark:border-gray-600 pt-2">
                {getSourceIcon(appointment.source)} {appointment.source === 'voice_ai' ? 'Booked via Voice AI' : 'Manually created'}
              </div>
            </div>

            {/* Arrow pointer */}
            <div className="absolute right-full top-3 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900 dark:border-r-gray-800" />
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // Standard Variant (Day View - more space)
  // ============================================================================

  if (variant === 'standard') {
    const heightNum = style.height ? parseInt(style.height as string) : 80;

    return (
      <div
        role="button"
        tabIndex={onClick ? 0 : -1}
        aria-label={ariaLabel}
        className={`
          absolute left-2 right-2 rounded-lg border-l-4 shadow-md cursor-pointer transition-all
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${getStatusColor(appointment.status)}
          ${className}
        `}
        style={{ ...style, zIndex: 10 }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div className="p-3 h-full overflow-hidden">
          {/* Time */}
          <div className="text-xs font-bold opacity-90 flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3" />
            {appointment.start_time} - {appointment.end_time}
          </div>

          {/* Customer Name */}
          <div className="text-sm font-semibold mb-1">{leadFullName}</div>

          {/* Appointment Type */}
          <div className="text-xs opacity-90 mb-1">{appointmentTypeName}</div>

          {/* Additional Info (for taller appointments) */}
          {heightNum > 100 && (
            <>
              {appointment.lead?.phone && (
                <div className="text-xs opacity-80 flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" />
                  {appointment.lead.phone}
                </div>
              )}
              {appointment.assigned_user && (
                <div className="text-xs opacity-80 flex items-center gap-1 mt-1">
                  <User className="w-3 h-3" />
                  {appointment.assigned_user.first_name} {appointment.assigned_user.last_name}
                </div>
              )}
              {appointment.lead?.company_name && (
                <div className="text-xs opacity-80 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {appointment.lead.company_name}
                </div>
              )}
            </>
          )}

          {/* Status Badge (for very tall appointments) */}
          {heightNum > 150 && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded">
                {formatStatusLabel(appointment.status)}
              </span>
            </div>
          )}

          {/* Source indicator for very tall appointments */}
          {heightNum > 180 && (
            <div className="mt-1 text-xs opacity-70">
              {getSourceIcon(appointment.source)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // Detailed Variant (List View or Modal)
  // ============================================================================

  return (
    <div
      role="button"
      tabIndex={onClick ? 0 : -1}
      aria-label={ariaLabel}
      className={`
        rounded-lg border-l-4 shadow-sm p-4 cursor-pointer transition-all
        focus:outline-none focus:ring-2 focus:ring-offset-2
        bg-white dark:bg-gray-800
        ${getStatusColor(appointment.status).replace('text-white', 'border-opacity-100')}
        ${className}
      `}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {appointmentTypeName}
            </h3>
            <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(appointment.status)}`}>
              {formatStatusLabel(appointment.status)}
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {getSourceIcon(appointment.source)} {appointment.source === 'voice_ai' ? 'Voice AI' : 'Manual'}
          </div>
        </div>

        {/* DateTime */}
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <CalendarIcon className="w-4 h-4 text-gray-500" />
          <span className="font-medium">
            {new Date(appointment.scheduled_date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span className="text-gray-500">•</span>
          <Clock className="w-4 h-4 text-gray-500" />
          <span>
            {appointment.start_time} - {appointment.end_time}
          </span>
        </div>

        {/* Customer Info */}
        {appointment.lead && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <User className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{leadFullName}</span>
            </div>
            {appointment.lead.phone && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Phone className="w-4 h-4 text-gray-500" />
                <span>{appointment.lead.phone}</span>
              </div>
            )}
            {appointment.lead.email && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{appointment.lead.email}</span>
              </div>
            )}
            {appointment.lead.company_name && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span>{appointment.lead.company_name}</span>
              </div>
            )}
          </div>
        )}

        {/* Assigned User */}
        {appointment.assigned_user && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <User className="w-4 h-4 text-gray-500" />
              <span>
                Assigned to: {appointment.assigned_user.first_name} {appointment.assigned_user.last_name}
              </span>
            </div>
          </div>
        )}

        {/* Notes */}
        {appointment.notes && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">{appointment.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
