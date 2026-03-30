'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Plus, Clock, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getCrewHours,
  logCrewHours,
} from '@/lib/api/financial';
import { getCrewMembers } from '@/lib/api/crew';
import { getProjectTasks, formatDate } from '@/lib/api/projects';
import type { CrewHourLog, CrewMember, PaginatedResponse } from '@/lib/types/financial';
import type { ProjectTask } from '@/lib/types/projects';

interface CrewHoursSectionProps {
  projectId: string;
  onDataChange: () => void;
}

export default function CrewHoursSection({ projectId, onDataChange }: CrewHoursSectionProps) {
  const [hours, setHours] = useState<PaginatedResponse<CrewHourLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    crew_member_id: '',
    task_id: '',
    log_date: new Date().toISOString().split('T')[0],
    hours_regular: '',
    hours_overtime: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadHours = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCrewHours({ project_id: projectId, page, limit: 20 });
      setHours(data);
    } catch {
      toast.error('Failed to load crew hours');
    } finally {
      setLoading(false);
    }
  }, [projectId, page]);

  useEffect(() => {
    loadHours();
  }, [loadHours]);

  const openForm = async () => {
    setShowForm(true);
    setForm({
      crew_member_id: '',
      task_id: '',
      log_date: new Date().toISOString().split('T')[0],
      hours_regular: '',
      hours_overtime: '',
      notes: '',
    });
    setErrors({});

    try {
      const [crewData, taskData] = await Promise.all([
        getCrewMembers({ limit: 100 }),
        getProjectTasks(projectId, { limit: 100 }),
      ]);
      setCrewMembers(crewData.data.filter((c) => c.is_active));
      setTasks(taskData.data);
    } catch {
      toast.error('Failed to load crew members or tasks');
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.crew_member_id) newErrors.crew_member_id = 'Crew member is required';
    if (!form.task_id) newErrors.task_id = 'Task is required';
    if (!form.log_date) newErrors.log_date = 'Date is required';
    const reg = parseFloat(form.hours_regular);
    if (!form.hours_regular || isNaN(reg) || reg <= 0) {
      newErrors.hours_regular = 'Regular hours must be greater than 0';
    }
    const ot = parseFloat(form.hours_overtime || '0');
    if (form.hours_overtime && (isNaN(ot) || ot < 0)) {
      newErrors.hours_overtime = 'Overtime hours must be 0 or more';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await logCrewHours({
        crew_member_id: form.crew_member_id,
        project_id: projectId,
        task_id: form.task_id || undefined,
        log_date: form.log_date,
        hours_regular: parseFloat(form.hours_regular),
        hours_overtime: form.hours_overtime ? parseFloat(form.hours_overtime) : undefined,
        notes: form.notes || undefined,
      });
      toast.success('Hours logged');
      setShowForm(false);
      loadHours();
      onDataChange();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to log hours');
    } finally {
      setSubmitting(false);
    }
  };

  const crewOptions = crewMembers.map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const taskOptions = tasks.map((t) => ({
    value: t.id,
    label: t.title,
  }));

  return (
    <>
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Crew Hours</h3>
          <Button size="sm" onClick={openForm} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Log Hours
          </Button>
        </div>

        {loading ? (
          <div className="py-12"><LoadingSpinner size="lg" centered /></div>
        ) : !hours || hours.data.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
              <Clock className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">No hours logged yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Log crew hours to track labor on this project.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Crew Member</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Task</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Regular</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Overtime</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Total</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.data.map((log) => {
                    const regular = parseFloat(log.hours_regular);
                    const overtime = parseFloat(log.hours_overtime);
                    const total = regular + overtime;
                    return (
                      <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-3 text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            {log.crew_member.first_name} {log.crew_member.last_name}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          {log.task?.title || '-'}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(log.log_date)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-900 dark:text-white font-medium">
                          {regular.toFixed(1)}h
                        </td>
                        <td className="py-3 px-3 text-right text-orange-600 dark:text-orange-400 font-medium">
                          {overtime > 0 ? `${overtime.toFixed(1)}h` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                          {total.toFixed(1)}h
                        </td>
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-[150px] truncate">
                          {log.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {hours.data.map((log) => {
                const regular = parseFloat(log.hours_regular);
                const overtime = parseFloat(log.hours_overtime);
                const total = regular + overtime;
                return (
                  <div key={log.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {log.crew_member.first_name} {log.crew_member.last_name}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">{total.toFixed(1)}h</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                      {log.task && <div>Task: {log.task.title}</div>}
                      <div>{formatDate(log.log_date)}</div>
                      <div>Regular: {regular.toFixed(1)}h {overtime > 0 && `| OT: ${overtime.toFixed(1)}h`}</div>
                      {log.notes && <div className="truncate">{log.notes}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {(hours.meta.pages ?? 0) > 1 && (
              <div className="mt-4">
                <PaginationControls
                  currentPage={page}
                  totalPages={hours.meta.pages ?? 1}
                  onNext={() => setPage((p) => p + 1)}
                  onPrevious={() => setPage((p) => p - 1)}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Log Hours Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Log Crew Hours" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Crew Member"
            required
            searchable
            options={crewOptions}
            value={form.crew_member_id}
            onChange={(val) => setForm({ ...form, crew_member_id: val })}
            error={errors.crew_member_id}
            placeholder="Select crew member"
          />

          <Select
            label="Task"
            required
            searchable
            options={taskOptions}
            value={form.task_id}
            onChange={(val) => setForm({ ...form, task_id: val })}
            error={errors.task_id}
            placeholder="Select task"
          />

          <DatePicker
            label="Date"
            required
            value={form.log_date}
            onChange={(e) => setForm({ ...form, log_date: e.target.value })}
            max={new Date().toISOString().split('T')[0]}
            error={errors.log_date}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Regular Hours"
              required
              type="number"
              step="0.5"
              min="0.01"
              value={form.hours_regular}
              onChange={(e) => setForm({ ...form, hours_regular: e.target.value })}
              error={errors.hours_regular}
              placeholder="8.0"
            />
            <Input
              label="Overtime Hours"
              type="number"
              step="0.5"
              min="0"
              value={form.hours_overtime}
              onChange={(e) => setForm({ ...form, hours_overtime: e.target.value })}
              error={errors.hours_overtime}
              placeholder="0.0"
            />
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes"
            rows={2}
          />

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              Log Hours
            </Button>
          </ModalActions>
        </form>
      </Modal>
    </>
  );
}
