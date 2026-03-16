// ============================================================================
// AdminCreateUserModal
// ============================================================================
// Modal form to create a new user directly in a specific tenant, bypassing
// the invite flow. Platform Admin only.
// Calls POST /admin/tenants/:tenantId/users
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { adminCreateUserInTenant } from '@/lib/api/users';
import { getAllRoles } from '@/lib/api/rbac';
import type { RoleWithPermissions } from '@/lib/types/rbac';

// =============================================================================
// Types
// =============================================================================

interface AdminCreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  tenantName: string;
}

interface FormErrors {
  email?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
  password?: string;
  phone?: string;
}

// =============================================================================
// Validation
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function validateForm(
  email: string,
  firstName: string,
  lastName: string,
  roleId: string,
  password: string,
  phone: string,
): FormErrors {
  const errors: FormErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  if (!firstName.trim()) {
    errors.firstName = 'First name is required';
  } else if (firstName.trim().length > 100) {
    errors.firstName = 'First name must be 100 characters or less';
  }

  if (!lastName.trim()) {
    errors.lastName = 'Last name is required';
  } else if (lastName.trim().length > 100) {
    errors.lastName = 'Last name must be 100 characters or less';
  }

  if (!roleId) {
    errors.roleId = 'Please select a role';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (!PASSWORD_REGEX.test(password)) {
    errors.password = 'Password must be 8+ characters with uppercase, lowercase, number, and special character';
  }

  if (phone && phone.trim().length > 20) {
    errors.phone = 'Phone must be 20 characters or less';
  }

  return errors;
}

// =============================================================================
// Component
// =============================================================================

export default function AdminCreateUserModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  tenantName,
}: AdminCreateUserModalProps) {
  // Form fields
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Roles data
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  // ---------------------------------------------------------------------------
  // Reset form + fetch roles when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setFirstName('');
      setLastName('');
      setRoleId('');
      setPassword('');
      setPhone('');
      setError(null);
      setFieldErrors({});
      setSubmitting(false);

      fetchRoles();
    }
  }, [isOpen]);

  async function fetchRoles() {
    try {
      setLoadingRoles(true);
      const data = await getAllRoles();
      // Filter to only active roles
      setRoles(data.filter((r) => r.is_active));
    } catch {
      setError('Failed to load roles. Please close and try again.');
    } finally {
      setLoadingRoles(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateForm(email, firstName, lastName, roleId, password, phone);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await adminCreateUserInTenant(tenantId, {
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role_id: roleId,
        password,
        phone: phone.trim() || undefined,
      });

      toast.success('User created successfully');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };

      if (apiError.status === 409) {
        setError(apiError.message || 'This user already has an active membership in this tenant or another organization.');
      } else if (apiError.status === 404) {
        setError(apiError.message || 'Tenant or role not found.');
      } else if (apiError.status === 400) {
        setError(apiError.message || 'Please check the form fields and try again.');
      } else {
        setError(apiError.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Clear field errors on input change
  // ---------------------------------------------------------------------------

  function clearServerError() {
    if (error) setError(null);
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    clearServerError();
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
  }

  function handleFirstNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFirstName(e.target.value);
    clearServerError();
    if (fieldErrors.firstName) setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
  }

  function handleLastNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLastName(e.target.value);
    clearServerError();
    if (fieldErrors.lastName) setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
  }

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRoleId(e.target.value);
    clearServerError();
    if (fieldErrors.roleId) setFieldErrors((prev) => ({ ...prev, roleId: undefined }));
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    clearServerError();
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhone(e.target.value);
    clearServerError();
    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Create User in ${tenantName}`} size="lg">
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Server error banner */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Email */}
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="user@example.com"
              error={fieldErrors.email}
              required
              autoFocus
              autoComplete="email"
            />

            {/* First Name / Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                type="text"
                value={firstName}
                onChange={handleFirstNameChange}
                placeholder="Jane"
                maxLength={100}
                error={fieldErrors.firstName}
                required
                autoComplete="given-name"
              />
              <Input
                label="Last Name"
                type="text"
                value={lastName}
                onChange={handleLastNameChange}
                placeholder="Doe"
                maxLength={100}
                error={fieldErrors.lastName}
                required
                autoComplete="family-name"
              />
            </div>

            {/* Role dropdown */}
            <div>
              <label
                htmlFor="create-user-role-select"
                className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
              >
                Role <span className="text-red-500 dark:text-red-400 ml-1">*</span>
              </label>

              {loadingRoles ? (
                <div className="flex items-center gap-2 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Loading roles...</span>
                </div>
              ) : (
                <select
                  id="create-user-role-select"
                  className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                  value={roleId}
                  onChange={handleRoleChange}
                  required
                >
                  <option value="">Select a role...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              )}

              {fieldErrors.roleId && (
                <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{fieldErrors.roleId}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter a secure password"
                error={fieldErrors.password}
                required
                autoComplete="new-password"
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                8+ characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
              </p>
            </div>

            {/* Phone (optional) */}
            <Input
              label="Phone (optional)"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              maxLength={20}
              error={fieldErrors.phone}
              autoComplete="tel"
            />
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={loadingRoles || roles.length === 0}
          >
            {!submitting && <UserPlus className="w-4 h-4" />}
            Create User
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
