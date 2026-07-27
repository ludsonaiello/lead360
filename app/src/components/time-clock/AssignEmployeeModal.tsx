/**
 * AssignEmployeeModal — create a new employee→project assignment.
 *
 * POST /api/v1/time-clock/employee-projects
 * Shows both selectors (searchable when the list is large), inline validation,
 * and surfaces 409 duplicate errors in-form so the user can pick a different
 * combination without losing context.
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Link2, UserPlus } from 'lucide-react';

import { Modal, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

import { createEmployeeProject } from '@/lib/api/time-clock';
import type { EmployeeProfile } from '@/lib/types/time-clock';
import type { Project } from '@/lib/types/projects';

interface AssignEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assignment: { employeeName: string; projectName: string }) => void;
  /**
   * Called when the backend rejects with a 409 duplicate. The parent is
   * expected to render an ErrorModal explaining the conflict (per sprint
   * task 2). Inline validation errors (missing fields, 400 payload issues)
   * stay inside the form.
   */
  onConflict?: (error: { title: string; message: string }) => void;
  employees: EmployeeProfile[];
  projects: Project[];
  defaultEmployeeId?: string;
  defaultProjectId?: string;
}

// The axios interceptor at src/lib/api/axios.ts rewrites rejected errors to
// `{ status, message, error, data }` at the top level, so we read the HTTP
// status and message from there directly — not from `error.response`.
interface ApiErrorShape {
  status?: number;
  message?: string | string[];
  error?: string;
  data?: { message?: string | string[]; error?: string };
}

function readStatus(err: unknown): number | undefined {
  return (err as ApiErrorShape)?.status;
}

function readMessage(err: unknown): string | undefined {
  const e = err as ApiErrorShape;
  const raw = e?.message ?? e?.data?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  return typeof raw === 'string' ? raw : undefined;
}

function formatEmployeeLabel(e: EmployeeProfile): string {
  const name = [e.user?.first_name, e.user?.last_name].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (e.user?.email) return e.user.email;
  return 'Employee';
}

function formatProjectLabel(p: Project): string {
  return p.project_number ? `${p.project_number} — ${p.name}` : p.name;
}

export function AssignEmployeeModal({
  isOpen,
  onClose,
  onSuccess,
  onConflict,
  employees,
  projects,
  defaultEmployeeId,
  defaultProjectId,
}: AssignEmployeeModalProps) {
  const [employeeId, setEmployeeId] = useState<string>(defaultEmployeeId ?? '');
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmployeeId(defaultEmployeeId ?? '');
      setProjectId(defaultProjectId ?? '');
      setEmployeeError(null);
      setProjectError(null);
      setFormError(null);
    }
  }, [isOpen, defaultEmployeeId, defaultProjectId]);

  const employeeOptions = useMemo(
    () =>
      employees
        .filter((e) => e.is_active)
        .map((e) => ({ value: e.id, label: formatEmployeeLabel(e) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [employees],
  );

  const projectOptions = useMemo(
    () =>
      projects
        .map((p) => ({ value: p.id, label: formatProjectLabel(p) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [projects],
  );

  const validate = (): boolean => {
    let valid = true;
    if (!employeeId) {
      setEmployeeError('Select an employee');
      valid = false;
    } else {
      setEmployeeError(null);
    }
    if (!projectId) {
      setProjectError('Select a project');
      valid = false;
    } else {
      setProjectError(null);
    }
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createEmployeeProject({
        employee_profile_id: employeeId,
        project_id: projectId,
      });
      const employee = employees.find((e) => e.id === employeeId);
      const project = projects.find((p) => p.id === projectId);
      onSuccess({
        employeeName: created.employee_profile
          ? formatEmployeeLabel(created.employee_profile)
          : employee
          ? formatEmployeeLabel(employee)
          : 'Employee',
        projectName:
          created.project?.name ?? project?.name ?? 'Project',
      });
    } catch (err) {
      const status = readStatus(err);
      const message = readMessage(err);
      if (status === 409) {
        // Sprint task 2: duplicate conflict → ErrorModal on the parent.
        // We also keep an inline error in case the parent does not provide
        // an onConflict handler.
        if (onConflict) {
          onConflict({
            title: 'Already assigned',
            message:
              message ||
              'This employee is already assigned to that project. Pick a different employee or project.',
          });
        } else {
          setFormError(
            message ||
              'This employee is already assigned to that project.',
          );
        }
      } else if (status === 404) {
        setFormError(message || 'Employee or project not found.');
      } else if (status === 400) {
        setFormError(message || 'The request was rejected. Please check the fields.');
      } else {
        setFormError(message || 'Could not create the assignment. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => undefined : onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <UserPlus className="h-5 w-5" aria-hidden="true" />
          </span>
          Assign Employee to Project
        </span>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Assigning an employee lets them clock in to this project when your time-clock
          mode is set to <em>specific addresses</em> or <em>active job sites</em>.
        </p>

        <Select
          label="Employee"
          required
          placeholder={employeeOptions.length ? 'Pick an employee' : 'No active employees'}
          options={employeeOptions}
          value={employeeId}
          onChange={(v) => {
            setEmployeeId(v);
            if (employeeError) setEmployeeError(null);
            if (formError) setFormError(null);
          }}
          searchable={employeeOptions.length > 5}
          error={employeeError ?? undefined}
          disabled={submitting || employeeOptions.length === 0}
        />

        <Select
          label="Project"
          required
          placeholder={projectOptions.length ? 'Pick a project' : 'No projects available'}
          options={projectOptions}
          value={projectId}
          onChange={(v) => {
            setProjectId(v);
            if (projectError) setProjectError(null);
            if (formError) setFormError(null);
          }}
          searchable={projectOptions.length > 5}
          error={projectError ?? undefined}
          disabled={submitting || projectOptions.length === 0}
        />

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          >
            <Link2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}
      </div>

      <ModalActions>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} loading={submitting}>
          {submitting ? 'Assigning…' : 'Assign Employee'}
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default AssignEmployeeModal;
