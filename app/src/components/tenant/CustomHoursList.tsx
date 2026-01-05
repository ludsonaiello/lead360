/**
 * CustomHoursList Component
 * Display and manage custom hours (holidays, special dates)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Edit2, Trash2, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { tenantApi } from '@/lib/api/tenant';
import { CustomHours } from '@/lib/types/tenant';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import CustomHoursFormModal from './CustomHoursFormModal';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';

// Helper to parse date string without timezone conversion
const parseDate = (dateStr: string): Date => {
  // For YYYY-MM-DD format, parse as local date to avoid timezone shifts
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function CustomHoursList() {
  const [customHours, setCustomHours] = useState<CustomHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHours, setEditingHours] = useState<CustomHours | null>(null);
  const [deletingHours, setDeletingHours] = useState<CustomHours | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadCustomHours();
  }, []);

  const loadCustomHours = async () => {
    try {
      setIsLoading(true);
      const data = await tenantApi.getAllCustomHours();
      // Sort by date (upcoming first)
      const sorted = data.sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
      setCustomHours(sorted);
      console.log(sorted);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load custom hours');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (hours: CustomHours) => {
    setEditingHours(hours);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingHours(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingHours(null);
  };

  const handleSuccess = () => {
    loadCustomHours();
    handleModalClose();
  };

  const handleDeleteClick = (hours: CustomHours) => {
    setDeletingHours(hours);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingHours) return;

    try {
      setIsDeleting(true);
      await tenantApi.deleteCustomHours(deletingHours.id);
      toast.success('Custom hours deleted successfully');
      setDeletingHours(null);
      loadCustomHours();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete custom hours');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTimeSlot = (hours: CustomHours) => {
    if (hours.closed) {
      return 'Closed';
    }

    const slots = [];
    if (hours.open_time1 && hours.close_time1) {
      slots.push(`${hours.open_time1} - ${hours.close_time1}`);
    }
    if (hours.open_time2 && hours.close_time2) {
      slots.push(`${hours.open_time2} - ${hours.close_time2}`);
    }

    return slots.length > 0 ? slots.join(', ') : 'Not set';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Custom Hours</h2>
        <Button onClick={handleAdd} size="md">
          <Plus className="w-5 h-5" />
          Add Custom Hours
        </Button>
      </div>

      {/* Empty state */}
      {customHours.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <Calendar className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No custom hours found
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Add holidays, special dates, or custom operating hours
          </p>
          <Button onClick={handleAdd} size="md">
            <Plus className="w-5 h-5" />
            Add Custom Hours
          </Button>
        </div>
      ) : (
        /* Custom hours table */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {customHours.map((hours) => {
                  const isPast = parseDate(hours.date) < new Date();

                  return (
                    <tr
                      key={hours.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        isPast ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {format(parseDate(hours.date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        {isPast && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">Past</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {hours.reason}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {hours.closed ? (
                          <Badge variant="danger" label="Closed" />
                        ) : (
                          <Badge variant="success" label="Open" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {formatTimeSlot(hours)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleEdit(hours)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(hours)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <CustomHoursFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
          customHours={editingHours}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingHours && (
        <Modal
          isOpen={!!deletingHours}
          onClose={() => setDeletingHours(null)}
          title="Delete Custom Hours"
          size="md"
        >
          <ModalContent>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete these custom hours?
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {deletingHours.reason}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Date: {format(parseDate(deletingHours.date), 'MMM dd, yyyy')}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Hours: {formatTimeSlot(deletingHours)}
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              This action cannot be undone.
            </p>
          </ModalContent>

          <ModalActions>
            <Button
              variant="secondary"
              onClick={() => setDeletingHours(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Custom Hours'}
            </Button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
}

export default CustomHoursList;
