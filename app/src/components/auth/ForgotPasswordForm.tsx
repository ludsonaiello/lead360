/**
 * Forgot Password Form Component
 * Request password reset email
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { formatErrorForDisplay } from '@/lib/utils/errors';
import { authApi } from '@/lib/api/auth';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [successModal, setSuccessModal] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      await authApi.forgotPassword(data.email);
      setSuccessModal(true);
      reset();
    } catch (error: any) {
      const errorInfo = formatErrorForDisplay(error, 'forgot-password');
      setErrorModal({ title: errorInfo.title, message: errorInfo.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <Input
          label="Email"
          type="email"
          {...register('email')}
          error={errors.email?.message}
          required
          autoFocus
          disabled={isLoading}
          placeholder="your.email@example.com"
        />

        <Button type="submit" fullWidth loading={isLoading}>
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </form>

      {/* Error Modal */}
      <Modal isOpen={!!errorModal} onClose={() => setErrorModal(null)} title={errorModal?.title || 'Error'}>
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300">{errorModal?.message}</p>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setErrorModal(null)}>Try Again</Button>
        </ModalActions>
      </Modal>

      {/* Success Modal */}
      <Modal isOpen={successModal} onClose={() => setSuccessModal(false)} title="Check Your Email">
        <ModalContent>
          <p className="text-gray-900 dark:text-gray-100">
            If an account with that email exists, a password reset link has been sent. Please check your email
            and follow the instructions.
          </p>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setSuccessModal(false)}>Close</Button>
        </ModalActions>
      </Modal>
    </>
  );
}

export default ForgotPasswordForm;
