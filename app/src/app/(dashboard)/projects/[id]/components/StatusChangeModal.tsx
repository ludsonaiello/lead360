'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle } from 'lucide-react';
import { updateProject, formatProjectStatus, getStatusBadgeVariant } from '@/lib/api/projects';
import type { Project, ProjectStatus } from '@/lib/types/projects';
import toast from 'react-hot-toast';

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Project) => void;
  project: Project;
}

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
];

export default function StatusChangeModal({ isOpen, onClose, onSuccess, project }: StatusChangeModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>(project.status);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (selectedStatus === project.status) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      const updated = await updateProject(project.id, { status: selectedStatus as ProjectStatus });
      toast.success(`Status changed to ${formatProjectStatus(selectedStatus)}`);
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const isCompletingProject = selectedStatus === 'completed' && project.status !== 'completed';
  const isCancelingProject = selectedStatus === 'canceled';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Project Status">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Current:</span>
          <Badge variant={getStatusBadgeVariant(project.status)} label={formatProjectStatus(project.status)} />
        </div>

        <Select
          label="New Status"
          options={STATUS_OPTIONS}
          value={selectedStatus}
          onChange={(val) => setSelectedStatus(val)}
        />

        {isCompletingProject && (
          <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <AlertTriangle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-300">
              Marking as completed will set the actual completion date to today.
            </p>
          </div>
        )}

        {isCancelingProject && (
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">
              Canceling a project is a significant action. The project will be marked as canceled.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={isCancelingProject ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={loading}
            disabled={selectedStatus === project.status}
          >
            {isCancelingProject ? 'Cancel Project' : 'Update Status'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
