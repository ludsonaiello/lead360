/**
 * ServiceRequestCardExpanded Component
 * Expandable service request with status change and full details
 */

'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  Calendar,
  AlertCircle,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  MapPin,
  Save,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import type { ServiceRequest } from '@/lib/types/leads';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ServiceRequestCardExpandedProps {
  serviceRequest: ServiceRequest;
  onUpdate?: (id: string, updates: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
}

const urgencyConfig = {
  low: { variant: 'neutral' as const, label: 'Low', icon: Clock },
  medium: { variant: 'info' as const, label: 'Medium', icon: Clock },
  high: { variant: 'warning' as const, label: 'High', icon: AlertCircle },
  emergency: { variant: 'danger' as const, label: 'Emergency', icon: AlertCircle },
};

const statusConfig = {
  new: { variant: 'blue' as const, label: 'New', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  pending: { variant: 'warning' as const, label: 'Pending', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  scheduled: { variant: 'info' as const, label: 'Scheduled', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  visit_scheduled: { variant: 'info' as const, label: 'Visit Scheduled', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
  quote_generated: { variant: 'info' as const, label: 'Quote Generated', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' },
  quote_sent: { variant: 'info' as const, label: 'Quote Sent', color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' },
  completed: { variant: 'success' as const, label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  cancelled: { variant: 'neutral' as const, label: 'Cancelled', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
};

export function ServiceRequestCardExpanded({
  serviceRequest,
  onUpdate,
  onDelete,
  canEdit = false,
  canDelete = false,
  className = ''
}: ServiceRequestCardExpandedProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState(serviceRequest.status);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const urgency = serviceRequest.time_demand ? urgencyConfig[serviceRequest.time_demand] : null;
  const status = statusConfig[serviceRequest.status] || { variant: 'neutral' as const, label: serviceRequest.status || 'Unknown', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' };

  const requestedDate = serviceRequest.extra_data?.requested_date;
  const estimatedValue = serviceRequest.extra_data?.estimated_value;
  const notes = serviceRequest.extra_data?.notes;

  const handleSaveStatus = async () => {
    if (!onUpdate || editStatus === serviceRequest.status) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(serviceRequest.id, { status: editStatus });
      toast.success('Service request status updated');
      setIsEditing(false);
    } catch (error: any) {
      // Axios interceptor returns structured error: { status, message, error, data }
      const errMsg = error?.message || 'Failed to update status';

      setErrorMessage(errMsg);
      setShowErrorModal(true);
      setEditStatus(serviceRequest.status); // Reset to original status
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditStatus(serviceRequest.status);
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(serviceRequest.id);
      toast.success('Service request deleted');
      setShowDeleteModal(false);
    } catch (error: any) {
      // Axios interceptor returns structured error: { status, message, error, data }
      const errMsg = error?.message || 'Failed to delete service request';

      setErrorMessage(errMsg);
      setShowErrorModal(true);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700
        transition-all duration-200
        ${className}
      `}
    >
      {/* Header - Always Visible */}
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base mb-1">
              {serviceRequest.service_name}
            </h3>
            {serviceRequest.service_type && serviceRequest.service_type !== serviceRequest.service_name && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {serviceRequest.service_type}
              </p>
            )}
            {(serviceRequest.description || serviceRequest.service_description) && (
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {serviceRequest.description || serviceRequest.service_description}
              </p>
            )}
          </div>

          {/* Status Badge or Editor */}
          <div className="flex items-center gap-1">
            {isEditing && canEdit ? (
              <div className="flex items-center gap-1">
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  disabled={isSaving}
                  className="px-2 py-1 text-xs font-medium border-2 border-gray-300 dark:border-gray-600 rounded
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">New</option>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="visit_scheduled">Visit Scheduled</option>
                  <option value="quote_generated">Quote Generated</option>
                  <option value="quote_sent">Quote Sent</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <Button
                  size="sm"
                  onClick={handleSaveStatus}
                  disabled={isSaving}
                  className="px-2 py-1 h-auto"
                >
                  <Save className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-2 py-1 h-auto"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => canEdit && setIsEditing(true)}
                  disabled={!canEdit}
                  className={`
                    px-2 py-1 rounded text-xs font-semibold flex items-center gap-1
                    ${status.color}
                    ${canEdit ? 'cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-offset-1 hover:ring-blue-400' : 'cursor-default'}
                    transition-all
                  `}
                  title={canEdit ? 'Click to change status' : 'Status'}
                >
                  {status.label}
                  {canEdit && <Edit2 className="w-3 h-3" />}
                </button>
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                    className="px-2 py-1 h-auto text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete service request"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Meta Information - Always Visible */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-600 dark:text-gray-400">
          {urgency && (
            <Badge variant={urgency.variant} icon={urgency.icon} className="text-xs">
              {urgency.label}
            </Badge>
          )}

          {requestedDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(requestedDate), 'MMM d, yyyy')}</span>
            </div>
          )}

          {estimatedValue !== undefined && estimatedValue > 0 && (
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              <span>${estimatedValue.toLocaleString()}</span>
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-auto flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isExpanded ? (
              <>
                <span className="hidden sm:inline">Hide Details</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Show Details</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t-2 border-gray-200 dark:border-gray-700 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900">
          {/* Service Type (if different from name) */}
          {serviceRequest.service_type && serviceRequest.service_type !== serviceRequest.service_name && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Service Type
              </h4>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {serviceRequest.service_type}
              </p>
            </div>
          )}

          {/* Full Description */}
          {(serviceRequest.description || serviceRequest.service_description) && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Description
              </h4>
              <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {serviceRequest.description || serviceRequest.service_description}
              </p>
            </div>
          )}

          {/* Address */}
          {serviceRequest.lead_address && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Service Address
              </h4>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {serviceRequest.lead_address.address_line1}
                {serviceRequest.lead_address.address_line2 && <>, {serviceRequest.lead_address.address_line2}</>}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {serviceRequest.lead_address.city}, {serviceRequest.lead_address.state} {serviceRequest.lead_address.zip_code}
              </p>
            </div>
          )}

          {/* Extra Data */}
          {serviceRequest.extra_data && Object.keys(serviceRequest.extra_data).length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Additional Information
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3">
                {requestedDate && (
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[120px]">
                      Requested Date:
                    </span>
                    <span className="text-xs text-gray-900 dark:text-gray-100">
                      {format(new Date(requestedDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {estimatedValue !== undefined && estimatedValue > 0 && (
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[120px]">
                      Estimated Value:
                    </span>
                    <span className="text-xs text-gray-900 dark:text-gray-100">
                      ${estimatedValue.toLocaleString()}
                    </span>
                  </div>
                )}
                {notes && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[120px]">
                      Notes:
                    </span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap flex-1">
                      {notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-500">
            <div>
              <span className="font-semibold">Created:</span>{' '}
              {format(new Date(serviceRequest.created_at), 'MMM d, yyyy h:mm a')}
            </div>
            {serviceRequest.updated_at && serviceRequest.updated_at !== serviceRequest.created_at && (
              <div>
                <span className="font-semibold">Updated:</span>{' '}
                {format(new Date(serviceRequest.updated_at), 'MMM d, yyyy h:mm a')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Modal */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600 dark:text-red-500" />
            <p className="text-gray-800 dark:text-gray-200 font-medium">
              {errorMessage}
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowErrorModal(false)}>
              OK
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Service Request"
        message={`Are you sure you want to delete this service request?\n\n"${serviceRequest.service_name}"\n\nThis action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}

export default ServiceRequestCardExpanded;
