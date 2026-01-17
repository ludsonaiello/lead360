/**
 * ServiceRequestCard Component
 * Display service request with status and details
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Calendar, AlertCircle, Clock, DollarSign } from 'lucide-react';
import type { ServiceRequest } from '@/lib/types/leads';
import { format } from 'date-fns';

interface ServiceRequestCardProps {
  serviceRequest: ServiceRequest;
  onClick?: () => void;
  className?: string;
}

const urgencyConfig = {
  low: { variant: 'neutral' as const, label: 'Low', icon: Clock },
  medium: { variant: 'info' as const, label: 'Medium', icon: Clock },
  high: { variant: 'warning' as const, label: 'High', icon: AlertCircle },
  emergency: { variant: 'danger' as const, label: 'Emergency', icon: AlertCircle },
};

const statusConfig = {
  new: { variant: 'blue' as const, label: 'New' },
  pending: { variant: 'warning' as const, label: 'Pending' },
  scheduled: { variant: 'info' as const, label: 'Scheduled' },
  visit_scheduled: { variant: 'info' as const, label: 'Visit Scheduled' },
  quote_generated: { variant: 'info' as const, label: 'Quote Generated' },
  quote_sent: { variant: 'info' as const, label: 'Quote Sent' },
  completed: { variant: 'success' as const, label: 'Completed' },
  cancelled: { variant: 'neutral' as const, label: 'Cancelled' },
};

export function ServiceRequestCard({ serviceRequest, onClick, className = '' }: ServiceRequestCardProps) {
  const urgency = serviceRequest.time_demand ? urgencyConfig[serviceRequest.time_demand] : null;
  const status = statusConfig[serviceRequest.status];

  const requestedDate = serviceRequest.extra_data?.requested_date;
  const estimatedValue = serviceRequest.extra_data?.estimated_value;

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700
        p-4 transition-all duration-200 hover:shadow-md
        ${onClick ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base mb-1 truncate">
            {serviceRequest.service_name}
          </h3>
          {serviceRequest.service_type && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {serviceRequest.service_type}
            </p>
          )}
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {/* Description */}
      {serviceRequest.service_description && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
          {serviceRequest.service_description}
        </p>
      )}

      {/* Meta Information */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
        {/* Urgency Badge - Only show if time_demand exists */}
        {urgency && (
          <div className="flex items-center gap-1.5">
            <Badge variant={urgency.variant} icon={urgency.icon}>
              {urgency.label}
            </Badge>
          </div>
        )}

        {/* Requested Date */}
        {requestedDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(new Date(requestedDate), 'MMM d, yyyy')}</span>
          </div>
        )}

        {/* Estimated Value */}
        {estimatedValue !== undefined && estimatedValue > 0 && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            <span>${estimatedValue.toLocaleString()}</span>
          </div>
        )}

        {/* Created Date */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-gray-500 dark:text-gray-500">
            {format(new Date(serviceRequest.created_at), 'MMM d, yyyy')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ServiceRequestCard;
