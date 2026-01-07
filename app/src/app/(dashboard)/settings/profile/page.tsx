/**
 * Profile Settings Page
 * Protected route for user profile management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Button } from '@/components/ui/Button';
import { SessionCard } from '@/components/auth/SessionCard';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { authApi } from '@/lib/api/auth';
import { Session } from '@/lib/types/auth';
import toast from 'react-hot-toast';
import Link from 'next/link';

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone format (use E.164 format like +15551234567)').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfileSettingsPage() {
  const { user, refreshUser, logoutAll } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
    },
  });

  // Load user profile and sessions
  useEffect(() => {
    if (user) {
      reset({
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone || '',
      });
    }

    loadSessions();
  }, [user, reset]);

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const data = await authApi.listSessions();
      setSessions(data.sessions);
    } catch (error) {
      toast.error('Failed to load sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setIsLoading(true);
      await authApi.updateProfile({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || undefined,
      });
      await refreshUser();
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await authApi.revokeSession(sessionId);
      toast.success('Device logged out successfully');
      loadSessions(); // Reload sessions
    } catch (error) {
      toast.error('Failed to logout device');
    }
  };

  const handleLogoutAll = async () => {
    try {
      setIsLoggingOutAll(true);
      await logoutAll();
      // User will be redirected to login by auth context
    } catch (error) {
      toast.error('Failed to logout all devices');
      setIsLoggingOutAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 font-medium hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">Profile Settings</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
        </div>

        <div className="space-y-6">
          {/* Personal Information Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Personal Information</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  {...register('first_name')}
                  error={errors.first_name?.message}
                  required
                  disabled={isLoading}
                />

                <Input
                  label="Last Name"
                  {...register('last_name')}
                  error={errors.last_name?.message}
                  required
                  disabled={isLoading}
                />
              </div>

              <Input
                label="Email"
                type="email"
                value={user?.email || ''}
                disabled
                helperText="Email cannot be changed"
              />

              <PhoneInput
                label="Phone (Optional)"
                {...register('phone')}
                value={watch('phone')}
                error={errors.phone?.message}
                disabled={isLoading}
                placeholder="+1 (555) 123-4567"
              />

              <div className="pt-4">
                <Button type="submit" loading={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>

          {/* Password Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Password</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-6">
              Change your password to keep your account secure
            </p>

            <Button onClick={() => setShowChangePasswordModal(true)}>
              Change Password
            </Button>
          </div>

          {/* Active Sessions Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Active Sessions</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mt-1">
                  Manage your active sessions across all devices
                </p>
              </div>

              {sessions.length > 1 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowLogoutAllModal(true)}
                >
                  Logout All Devices
                </Button>
              )}
            </div>

            {loadingSessions ? (
              <LoadingSpinner centered />
            ) : sessions.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400 font-medium py-8">
                No active sessions found
              </p>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onRevoke={handleRevokeSession}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />

      {/* Logout All Confirmation Modal */}
      <Modal
        isOpen={showLogoutAllModal}
        onClose={() => setShowLogoutAllModal(false)}
        title="Logout All Devices"
      >
        <ModalContent>
          <p className="text-gray-900 dark:text-gray-100">
            Are you sure you want to logout from all devices? You will need to log in again on each device.
          </p>
        </ModalContent>
        <ModalActions>
          <Button variant="ghost" onClick={() => setShowLogoutAllModal(false)} disabled={isLoggingOutAll}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleLogoutAll} loading={isLoggingOutAll}>
            {isLoggingOutAll ? 'Logging Out...' : 'Logout All'}
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
