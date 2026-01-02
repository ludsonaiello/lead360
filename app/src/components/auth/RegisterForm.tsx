/**
 * Register Form Component
 * Multi-step registration with subdomain availability check
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Button } from '@/components/ui/Button';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { registerSchema, type RegisterFormData } from '@/lib/utils/validation';
import { authApi } from '@/lib/api/auth';

type Step = 1 | 2 | 3;

export function RegisterForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  });

  const password = watch('password');
  const subdomain = watch('tenant_subdomain');

  // Debounced subdomain check
  useEffect(() => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainStatus('idle');
      return;
    }

    setSubdomainStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const available = await authApi.checkSubdomain(subdomain);
        setSubdomainStatus(available ? 'available' : 'taken');
      } catch (error) {
        setSubdomainStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [subdomain]);

  const handleNext = async () => {
    let fieldsToValidate: (keyof RegisterFormData)[] = [];

    if (currentStep === 1) {
      fieldsToValidate = ['tenant_subdomain', 'company_name'];
    } else if (currentStep === 2) {
      fieldsToValidate = ['first_name', 'last_name', 'email', 'phone', 'password', 'confirm_password'];
    }

    const isValid = await trigger(fieldsToValidate);

    if (isValid && currentStep === 1 && subdomainStatus !== 'available') {
      return; // Don't proceed if subdomain is not available
    }

    if (isValid) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => (prev - 1) as Step);
  };

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);

      // Remove confirm_password before sending to API
      const { confirm_password, ...registrationData } = data;

      // Ensure phone is in E.164 format or undefined
      const payload = {
        ...registrationData,
        phone: registrationData.phone && registrationData.phone.trim() !== ''
          ? registrationData.phone
          : undefined,
      };

      await authApi.register(payload);
      setSuccessModal(true);
    } catch (error: any) {
      setErrorModal(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModal(false);
    router.push('/login');
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm
                  ${
                    currentStep >= step
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }
                `}
              >
                {step}
              </div>
              {step < 3 && (
                <div
                  className={`
                    flex-1 h-1 mx-2
                    ${
                      currentStep > step
                        ? 'bg-blue-600 dark:bg-blue-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }
                  `}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Company Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Company Information</h3>

            <Input
              label="Company Name"
              {...register('company_name')}
              error={errors.company_name?.message}
              required
              autoFocus
              disabled={isLoading}
            />

            <div>
              <Input
                label="Subdomain"
                {...register('tenant_subdomain')}
                error={errors.tenant_subdomain?.message}
                required
                disabled={isLoading}
                helperText="This will be your unique URL: subdomain.lead360.com"
                rightIcon={
                  subdomainStatus === 'checking' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />
                  ) : subdomainStatus === 'available' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : subdomainStatus === 'taken' ? (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : null
                }
              />
              {subdomainStatus === 'available' && (
                <p className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">✓ Available</p>
              )}
              {subdomainStatus === 'taken' && (
                <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">✗ Not available</p>
              )}
            </div>

            <Button type="button" onClick={handleNext} fullWidth disabled={subdomainStatus !== 'available'}>
              Next
            </Button>
          </div>
        )}

        {/* Step 2: User Info */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Your Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                {...register('first_name')}
                error={errors.first_name?.message}
                required
                autoFocus
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
              {...register('email')}
              error={errors.email?.message}
              required
              disabled={isLoading}
            />

            <PhoneInput
              label="Phone (Optional)"
              {...register('phone')}
              error={errors.phone?.message}
              disabled={isLoading}
              placeholder="+1 (555) 123-4567"
            />

            <div>
              <Input
                label="Password"
                type="password"
                {...register('password')}
                error={errors.password?.message}
                required
                disabled={isLoading}
              />
              <PasswordStrengthMeter password={password || ''} />
            </div>

            <Input
              label="Confirm Password"
              type="password"
              {...register('confirm_password')}
              error={errors.confirm_password?.message}
              required
              disabled={isLoading}
            />

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={handleBack} fullWidth disabled={isLoading}>
                Back
              </Button>
              <Button type="button" onClick={handleNext} fullWidth disabled={isLoading}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Review Your Information</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mt-2">
                Please verify your details before creating your account
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 space-y-5 border border-gray-200 dark:border-gray-700">
              <div className="pb-4 border-b border-gray-300 dark:border-gray-600">
                <p className="text-xs uppercase tracking-wide font-bold text-gray-500 dark:text-gray-400 mb-2">
                  Company Details
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Company Name</p>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">{watch('company_name')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Your Unique URL</p>
                    <p className="text-base font-bold text-blue-600 dark:text-blue-400">{watch('tenant_subdomain')}.lead360.com</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide font-bold text-gray-500 dark:text-gray-400 mb-2">
                  Account Owner
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Full Name</p>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {watch('first_name')} {watch('last_name')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Email Address</p>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">{watch('email')}</p>
                  </div>
                  {watch('phone') && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Phone Number</p>
                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{watch('phone')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="secondary" onClick={handleBack} fullWidth disabled={isLoading}>
                Back
              </Button>
              <Button type="submit" fullWidth loading={isLoading}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Error Modal */}
      <Modal isOpen={!!errorModal} onClose={() => setErrorModal(null)} title="Registration Failed">
        <ModalContent>
          <p className="text-gray-900 dark:text-gray-100">{errorModal}</p>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setErrorModal(null)}>Try Again</Button>
        </ModalActions>
      </Modal>

      {/* Success Modal */}
      <Modal isOpen={successModal} onClose={handleSuccessClose} title="Registration Successful!">
        <ModalContent>
          <p className="text-gray-900 dark:text-gray-100">
            Your account has been created successfully. Please check your email to activate your account.
          </p>
        </ModalContent>
        <ModalActions>
          <Button onClick={handleSuccessClose}>Go to Login</Button>
        </ModalActions>
      </Modal>
    </>
  );
}

export default RegisterForm;
