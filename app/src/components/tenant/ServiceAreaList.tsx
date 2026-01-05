/**
 * ServiceAreaList Component
 * Display and manage service areas (cities, ZIP codes, radius)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Map, Edit2, Trash2, Plus, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tenantApi } from '@/lib/api/tenant';
import { ServiceArea } from '@/lib/types/tenant';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import ServiceAreaFormModal from './ServiceAreaFormModal';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';

export function ServiceAreaList() {
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [deletingArea, setDeletingArea] = useState<ServiceArea | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadServiceAreas();
  }, []);

  const loadServiceAreas = async () => {
    try {
      setIsLoading(true);
      const data = await tenantApi.getAllServiceAreas();
      setServiceAreas(data);
      console.log(data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load service areas');
    } finally {
      setIsLoading(false);
    }
  };

  console.log(serviceAreas);

  const handleEdit = (area: ServiceArea) => {
    setEditingArea(area);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingArea(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingArea(null);
  };

  const handleSuccess = () => {
    loadServiceAreas();
    handleModalClose();
  };

  const handleDeleteClick = (area: ServiceArea) => {
    setDeletingArea(area);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingArea) return;

    try {
      setIsDeleting(true);
      await tenantApi.deleteServiceArea(deletingArea.id);
      toast.success('Service area deleted successfully');
      setDeletingArea(null);
      loadServiceAreas();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete service area');
    } finally {
      setIsDeleting(false);
    }
  };

  const getAreaTypeBadge = (type: string) => {
    const variants: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
      city: 'info',
      zipcode: 'success',
      radius: 'warning',
      state: 'neutral',
    };

    const labels: Record<string, string> = {
      city: 'City',
      zipcode: 'ZIP Code',
      radius: 'Radius',
      state: 'Entire State',
    };

    return (
      <Badge
        variant={variants[type] || 'neutral'}
        label={labels[type] || type.charAt(0).toUpperCase() + type.slice(1)}
      />
    );
  };

  const formatAreaDescription = (area: ServiceArea) => {
    switch (area.type) {
      case 'city':
        return `${area.value}, ${area.state}`;
      case 'zipcode':
        return area.value;
      case 'radius':
        return `${area.radius_miles} miles from (${parseFloat(area.latitude).toFixed(4)}, ${parseFloat(area.longitude).toFixed(4)})`;
      case 'state':
        return area.value; // Already contains state name
      default:
        return 'Unknown';
    }
  };

  // Group areas by type
  const groupedAreas = {
    city: serviceAreas.filter((a) => a.type === 'city'),
    zipcode: serviceAreas.filter((a) => a.type === 'zipcode'),
    radius: serviceAreas.filter((a) => a.type === 'radius'),
    state: serviceAreas.filter((a) => a.type === 'state'),
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Service Areas</h2>
        <Button onClick={handleAdd} size="md">
          <Plus className="w-5 h-5" />
          Add Service Area
        </Button>
      </div>

      {/* Empty state */}
      {serviceAreas.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <Map className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No service areas found
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Define the geographic areas where you provide services
          </p>
          <Button onClick={handleAdd} size="md">
            <Plus className="w-5 h-5" />
            Add Service Area
          </Button>
        </div>
      ) : (
        /* Grouped service areas */
        <div className="space-y-6">
          {/* Cities */}
          {groupedAreas.city.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Cities ({groupedAreas.city.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedAreas.city.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {area.value}, {area.state}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {parseFloat(area.latitude).toFixed(4)}, {parseFloat(area.longitude).toFixed(4)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(area)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(area)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ZIP Codes */}
          {groupedAreas.zipcode.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                ZIP Codes ({groupedAreas.zipcode.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {groupedAreas.zipcode.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {area.value}
                      </p>
                      {area.city_name && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {area.city_name}, {area.state}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => handleEdit(area)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(area)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Radius Areas */}
          {groupedAreas.radius.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Map className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                Radius Areas ({groupedAreas.radius.length})
              </h3>
              <div className="space-y-3">
                {groupedAreas.radius.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {area.value}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Center: {parseFloat(area.latitude).toFixed(4)}, {parseFloat(area.longitude).toFixed(4)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(area)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(area)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entire States */}
          {groupedAreas.state.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Entire States ({groupedAreas.state.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {groupedAreas.state.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {area.value}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(area)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(area)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <ServiceAreaFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
          serviceArea={editingArea}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingArea && (
        <Modal
          isOpen={!!deletingArea}
          onClose={() => setDeletingArea(null)}
          title="Delete Service Area"
          size="md"
        >
          <ModalContent>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete this service area?
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                {getAreaTypeBadge(deletingArea.type)}
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {formatAreaDescription(deletingArea)}
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              This action cannot be undone.
            </p>
          </ModalContent>

          <ModalActions>
            <Button
              variant="secondary"
              onClick={() => setDeletingArea(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Service Area'}
            </Button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
}

export default ServiceAreaList;
