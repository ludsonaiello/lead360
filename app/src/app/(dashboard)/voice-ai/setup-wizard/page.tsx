/**
 * Voice AI Setup Wizard - Full Page
 * 7-step wizard with inline editing for all configuration
 * Route: /(dashboard)/voice-ai/setup-wizard
 * Permission: Owner, Admin only
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Briefcase,
  MapPin,
  FileText,
  Phone,
  PartyPopper,
  ArrowLeft,
  ArrowRight,
  Save,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import IndustrySelector from '@/components/tenant/IndustrySelector';
import * as tenantApi from '@/lib/api/tenant';
import * as voiceAiApi from '@/lib/api/voice-ai';
import { toast } from 'react-hot-toast';
import type { BusinessHours, Service, ServiceArea, Industry } from '@/lib/types/tenant';
import type { TransferNumber } from '@/lib/types/voice-ai';

interface SetupStatus {
  businessHours: boolean;
  services: boolean;
  industries: boolean;
  serviceAreas: boolean;
  businessDescription: boolean;
  transferNumbers: boolean;
}

interface WizardStep {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
}

export default function VoiceAISetupWizardPage() {
  const router = useRouter();

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatus>({
    businessHours: false,
    services: false,
    industries: false,
    serviceAreas: false,
    businessDescription: false,
    transferNumbers: false,
  });

  // Data state
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [assignedServices, setAssignedServices] = useState<Service[]>([]);
  const [selectedIndustryIds, setSelectedIndustryIds] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [transferNumbers, setTransferNumbers] = useState<TransferNumber[]>([]);
  const [businessDescription, setBusinessDescription] = useState('');

  // Saving states
  const [savingDescription, setSavingDescription] = useState(false);
  const [savingServices, setSavingServices] = useState(false);
  const [savingIndustries, setSavingIndustries] = useState(false);
  const [savingHours, setSavingHours] = useState(false);

  // Error states
  const [hoursErrors, setHoursErrors] = useState<Record<string, string>>({});

  // Wizard steps
  const steps: WizardStep[] = [
    { id: 'welcome', label: 'Welcome', icon: PartyPopper },
    { id: 'hours', label: 'Business Hours', icon: Clock },
    { id: 'services', label: 'Services', icon: Briefcase },
    { id: 'industries', label: 'Industries', icon: Briefcase },
    { id: 'areas', label: 'Service Areas', icon: MapPin },
    { id: 'description', label: 'About Your Business', icon: FileText },
    { id: 'transfer', label: 'Transfer Numbers', icon: Phone },
    { id: 'complete', label: 'Complete', icon: CheckCircle },
  ];

  // Load setup status and data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [tenant, hours, allSvcs, assignedSvcs, assignedInds, areas, transfers] = await Promise.all([
        tenantApi.getCurrentTenant(),
        tenantApi.getBusinessHours(),
        tenantApi.getAllServices(),
        tenantApi.getAssignedServices(),
        tenantApi.getAssignedIndustries(),
        tenantApi.getAllServiceAreas(),
        voiceAiApi.getAllTransferNumbers(),
      ]);

      // Set data
      setBusinessHours(hours);
      setAllServices(allSvcs);
      setAssignedServices(assignedSvcs);
      setSelectedIndustryIds(assignedInds.map((i) => i.id));
      setServiceAreas(areas);
      setTransferNumbers(transfers);
      setBusinessDescription(tenant.business_description || '');

      // Check status - BusinessHours is a single object, not array
      const hasBusinessHours = hours && (
        !hours.monday_closed || !hours.tuesday_closed || !hours.wednesday_closed ||
        !hours.thursday_closed || !hours.friday_closed || !hours.saturday_closed || !hours.sunday_closed
      );

      setStatus({
        businessHours: hasBusinessHours,
        services: assignedSvcs.length > 0,
        industries: assignedInds.length > 0,
        serviceAreas: areas.length > 0,
        businessDescription: !!tenant.business_description && tenant.business_description.trim().length > 0,
        transferNumbers: transfers.length > 0,
      });
    } catch (error: any) {
      console.error('Failed to load setup data:', error);
      toast.error('Failed to load setup information');
    } finally {
      setLoading(false);
    }
  };

  const saveBusinessDescription = async () => {
    if (!businessDescription.trim()) {
      toast.error('Please enter a business description');
      return;
    }

    try {
      setSavingDescription(true);
      await tenantApi.updateTenantProfile({
        business_description: businessDescription,
      });
      setStatus({ ...status, businessDescription: true });
      toast.success('Business description saved');
    } catch (error: any) {
      console.error('Failed to save business description:', error);
      toast.error(error.response?.data?.message || 'Failed to save business description');
    } finally {
      setSavingDescription(false);
    }
  };

  const saveServices = async () => {
    try {
      setSavingServices(true);
      const serviceIds = assignedServices.map((s) => s.id);
      await tenantApi.assignServices({ service_ids: serviceIds });
      setStatus({ ...status, services: serviceIds.length > 0 });
      toast.success('Services saved');
    } catch (error: any) {
      console.error('Failed to save services:', error);
      toast.error(error.response?.data?.message || 'Failed to save services');
    } finally {
      setSavingServices(false);
    }
  };

  const saveIndustries = async () => {
    try {
      setSavingIndustries(true);
      await tenantApi.assignIndustries({ industry_ids: selectedIndustryIds });
      setStatus({ ...status, industries: selectedIndustryIds.length > 0 });
      toast.success('Industries saved');
    } catch (error: any) {
      console.error('Failed to save industries:', error);
      toast.error(error.response?.data?.message || 'Failed to save industries');
    } finally {
      setSavingIndustries(false);
    }
  };

  const toggleService = (service: Service) => {
    const isAssigned = assignedServices.some((s) => s.id === service.id);
    if (isAssigned) {
      setAssignedServices(assignedServices.filter((s) => s.id !== service.id));
    } else {
      setAssignedServices([...assignedServices, service]);
    }
  };

  // Validate times for a specific day
  const validateDay = (day: string, data: BusinessHours): Record<string, string> => {
    const errors: Record<string, string> = {};
    const closedKey = `${day}_closed` as keyof BusinessHours;
    const open1Key = `${day}_open1` as keyof BusinessHours;
    const close1Key = `${day}_close1` as keyof BusinessHours;
    const open2Key = `${day}_open2` as keyof BusinessHours;
    const close2Key = `${day}_close2` as keyof BusinessHours;

    const isClosed = data[closedKey];
    const open1 = data[open1Key] as string | null;
    const close1 = data[close1Key] as string | null;
    const open2 = data[open2Key] as string | null;
    const close2 = data[close2Key] as string | null;

    // Skip validation if day is closed
    if (isClosed) return errors;

    // Validate first period (open1 must be before close1)
    if (open1 && close1) {
      if (open1 >= close1) {
        errors[open1Key as string] = 'Opening time must be before closing time';
        errors[close1Key as string] = 'Closing time must be after opening time';
      }
    }

    // Validate second period if exists (lunch break scenario)
    if (open2 && close2) {
      // open2 must be before close2
      if (open2 >= close2) {
        errors[open2Key as string] = 'Afternoon opening must be before afternoon closing';
        errors[close2Key as string] = 'Afternoon closing must be after afternoon opening';
      }

      // close1 must be before open2 (lunch break must be after morning closes)
      if (close1 && close1 >= open2) {
        if (!errors[close1Key as string]) {
          errors[close1Key as string] = 'Morning closing must be before afternoon opening';
        }
        if (!errors[open2Key as string]) {
          errors[open2Key as string] = 'Afternoon opening must be after morning closing';
        }
      }

      // open1 must be before open2
      if (open1 && open1 >= open2) {
        if (!errors[open1Key as string]) {
          errors[open1Key as string] = 'Morning opening must be before afternoon opening';
        }
        if (!errors[open2Key as string]) {
          errors[open2Key as string] = 'Afternoon opening must be after morning opening';
        }
      }

      // close1 must be before close2
      if (close1 && close1 >= close2) {
        if (!errors[close1Key as string]) {
          errors[close1Key as string] = 'Morning closing must be before afternoon closing';
        }
        if (!errors[close2Key as string]) {
          errors[close2Key as string] = 'Afternoon closing must be after morning closing';
        }
      }
    }

    return errors;
  };

  // Validate all days
  const validateBusinessHours = (data: BusinessHours): Record<string, string> => {
    const allErrors: Record<string, string> = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    days.forEach((day) => {
      const dayErrors = validateDay(day, data);
      Object.assign(allErrors, dayErrors);
    });

    return allErrors;
  };

  const saveBusinessHours = async () => {
    if (!businessHours) return;

    // Run frontend validation first
    const validationErrors = validateBusinessHours(businessHours);
    if (Object.keys(validationErrors).length > 0) {
      setHoursErrors(validationErrors);
      toast.error('Please fix the validation errors before saving');
      return;
    }

    try {
      setSavingHours(true);
      setHoursErrors({}); // Clear previous errors

      // Filter out system-managed fields (id, tenant_id, created_at, updated_at)
      const { id, tenant_id, created_at, updated_at, ...hoursData } = businessHours;

      const updated = await tenantApi.updateBusinessHours(hoursData);
      setBusinessHours(updated);
      setStatus({ ...status, businessHours: true });
      toast.success('Business hours saved');
    } catch (error: any) {
      console.error('Failed to save business hours:', error);

      // Parse backend validation errors
      const errorData = error.response?.data;
      const fieldErrors: Record<string, string> = {};

      // Try multiple error formats
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        // Structured validation errors: { errors: [{ field, message }] }
        errorData.errors.forEach((err: any) => {
          const field = err.field || err.property;
          const message = err.message || err.error;
          if (field && message) {
            fieldErrors[field] = message;
          }
        });
      } else if (Array.isArray(errorData?.message)) {
        // Message is an array of strings
        errorData.message.forEach((msg: string) => {
          const colonIndex = msg.indexOf(':');
          if (colonIndex > 0) {
            const field = msg.substring(0, colonIndex).trim().toLowerCase();
            const message = msg.substring(colonIndex + 1).trim();
            fieldErrors[field] = message;
          }
        });
      } else if (typeof errorData?.message === 'string') {
        // Try to parse message string for field-level errors
        // Format: "field: error message" or "field1: error1, field2: error2"
        const errorText = errorData.message;

        // Split by comma, semicolon, or newline
        const errorLines = errorText.split(/[,;\n]/).map((line: string) => line.trim()).filter((line: string) => line.length > 0);

        errorLines.forEach((line: string) => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const field = line.substring(0, colonIndex).trim().toLowerCase();
            const message = line.substring(colonIndex + 1).trim();
            fieldErrors[field] = message;
          }
        });
      }

      // Set errors and show appropriate message
      if (Object.keys(fieldErrors).length > 0) {
        setHoursErrors(fieldErrors);
        toast.error('Please fix the validation errors below');
      } else {
        // No field-specific errors, show generic message
        toast.error(errorData?.message || 'Failed to save business hours');
      }
    } finally {
      setSavingHours(false);
    }
  };

  const updateHoursField = (field: keyof BusinessHours, value: any) => {
    if (!businessHours) return;

    // Clear error for this field when editing
    if (hoursErrors[field as string]) {
      const newErrors = { ...hoursErrors };
      delete newErrors[field as string];

      // Also clear day-level errors (e.g., "monday")
      const day = (field as string).split('_')[0];
      if (newErrors[day]) {
        delete newErrors[day];
      }

      setHoursErrors(newErrors);
    }

    // Special handling: when unchecking "Closed", set default times
    if (field.endsWith('_closed') && value === false) {
      const day = field.replace('_closed', '');
      const open1Key = `${day}_open1` as keyof BusinessHours;
      const close1Key = `${day}_close1` as keyof BusinessHours;

      setBusinessHours({
        ...businessHours,
        [field]: value,
        // Only set defaults if currently null
        [open1Key]: businessHours[open1Key] || '09:00',
        [close1Key]: businessHours[close1Key] || '17:00',
      });
    } else {
      setBusinessHours({ ...businessHours, [field]: value });
    }
  };

  const addSplitShift = (day: string) => {
    if (!businessHours) return;
    const open2Key = `${day}_open2` as keyof BusinessHours;
    const close2Key = `${day}_close2` as keyof BusinessHours;
    setBusinessHours({
      ...businessHours,
      [open2Key]: '13:00',
      [close2Key]: '14:00',
    });
  };

  const removeSplitShift = (day: string) => {
    if (!businessHours) return;
    const open2Key = `${day}_open2` as keyof BusinessHours;
    const close2Key = `${day}_close2` as keyof BusinessHours;
    setBusinessHours({
      ...businessHours,
      [open2Key]: null,
      [close2Key]: null,
    });
  };

  const isSetupComplete = (): boolean => {
    return (
      status.businessHours &&
      status.services &&
      status.industries &&
      status.serviceAreas &&
      status.businessDescription
    );
  };

  const handleFinish = () => {
    if (isSetupComplete()) {
      localStorage.setItem('voice_ai_setup_completed', 'true');
      toast.success('Voice AI setup complete!');
      router.push('/voice-ai/settings');
    } else {
      toast.error('Please complete all required steps before finishing');
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  const renderStepContent = () => {
    if (loading) {
      return (
        <div className="py-24 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    switch (steps[currentStep].id) {
      case 'welcome':
        return (
          <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
            <PartyPopper className="h-20 w-20 text-blue-600 dark:text-blue-400 mx-auto" />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Welcome to Voice AI Setup
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Let's configure your Voice AI agent in just a few steps.
              This ensures your agent has all the information needed to handle calls professionally.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg inline-block">
              <div className="flex items-center gap-3 text-blue-800 dark:text-blue-200">
                <CheckCircle className="h-6 w-6" />
                <span className="font-semibold text-lg">Takes about 10 minutes</span>
              </div>
            </div>
          </div>
        );

      case 'hours':
        if (!businessHours) {
          return (
            <div className="max-w-4xl mx-auto">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                      Business hours not found
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Unable to load business hours data.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const dayLabels: Record<string, string> = {
          monday: 'Monday',
          tuesday: 'Tuesday',
          wednesday: 'Wednesday',
          thursday: 'Thursday',
          friday: 'Friday',
          saturday: 'Saturday',
          sunday: 'Sunday',
        };

        return (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <Clock className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Business Hours
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Set your operating hours so the AI agent can inform callers when you're available.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              {/* Error summary banner */}
              {Object.keys(hoursErrors).length > 0 && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-100 mb-1">
                        Validation Errors
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Please fix the errors below before saving.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {days.map((day) => {
                  const closedKey = `${day}_closed` as keyof BusinessHours;
                  const open1Key = `${day}_open1` as keyof BusinessHours;
                  const close1Key = `${day}_close1` as keyof BusinessHours;
                  const open2Key = `${day}_open2` as keyof BusinessHours;
                  const close2Key = `${day}_close2` as keyof BusinessHours;

                  const isClosed = businessHours[closedKey] as boolean;

                  // Check for errors related to this day
                  const dayError = hoursErrors[day] ||
                    hoursErrors[open1Key as string] ||
                    hoursErrors[close1Key as string] ||
                    hoursErrors[open2Key as string] ||
                    hoursErrors[close2Key as string];

                  const hasError = !!dayError;

                  return (
                    <div key={day} className="py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="w-32">
                          <span className={`font-medium ${hasError ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {dayLabels[day]}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isClosed}
                            onChange={(e) => updateHoursField(closedKey, e.target.checked)}
                            className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <label className="text-sm text-gray-700 dark:text-gray-300">Closed</label>
                        </div>

                        {!isClosed && (
                          <div className="flex items-center gap-2 flex-1 flex-wrap">
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={(businessHours[open1Key] as string) || '09:00'}
                                onChange={(e) => updateHoursField(open1Key, e.target.value)}
                                className={`px-3 py-2 border ${hasError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 ${hasError ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                              />
                              <span className="text-gray-500">-</span>
                              <input
                                type="time"
                                value={(businessHours[close1Key] as string) || '17:00'}
                                onChange={(e) => updateHoursField(close1Key, e.target.value)}
                                className={`px-3 py-2 border ${hasError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 ${hasError ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                              />
                            </div>

                            {businessHours[open2Key] ? (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">•</span>
                                <input
                                  type="time"
                                  value={(businessHours[open2Key] as string) || ''}
                                  onChange={(e) => updateHoursField(open2Key, e.target.value || null)}
                                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                  type="time"
                                  value={(businessHours[close2Key] as string) || ''}
                                  onChange={(e) => updateHoursField(close2Key, e.target.value || null)}
                                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  onClick={() => removeSplitShift(day)}
                                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title="Remove split shift"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addSplitShift(day)}
                                className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                                Add Split Shift
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Error message display */}
                      {hasError && (
                        <div className="mt-2 ml-36 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>{dayError}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                {status.businessHours && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Hours saved successfully</span>
                  </div>
                )}
                <div className={status.businessHours ? '' : 'w-full flex justify-end'}>
                  <Button
                    variant="primary"
                    onClick={saveBusinessHours}
                    loading={savingHours}
                  >
                    <Save className="h-4 w-4" />
                    Save Business Hours
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'services':
        return (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <Briefcase className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Services Offered
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Select the services you offer so the AI agent can discuss them with callers.
                </p>
              </div>
            </div>

            {allServices.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {allServices.map((service) => {
                    const isAssigned = assignedServices.some((s) => s.id === service.id);
                    return (
                      <label
                        key={service.id}
                        className={`
                          flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all
                          ${
                            isAssigned
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => toggleService(service)}
                          className="h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {service.name}
                          </div>
                          {service.description && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {service.description}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {assignedServices.length} service{assignedServices.length !== 1 ? 's' : ''} selected
                  </div>
                  <Button
                    variant="primary"
                    onClick={saveServices}
                    loading={savingServices}
                    disabled={assignedServices.length === 0}
                  >
                    <Save className="h-4 w-4" />
                    Save Services
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  No services available. Contact your administrator.
                </p>
              </div>
            )}
          </div>
        );

      case 'industries':
        return (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <Briefcase className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Industries
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Select the industries you serve so the AI agent can understand your business focus.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <IndustrySelector
                value={selectedIndustryIds}
                onChange={setSelectedIndustryIds}
                required={false}
              />

              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedIndustryIds.length} industr{selectedIndustryIds.length !== 1 ? 'ies' : 'y'} selected
                </div>
                <div className="flex items-center gap-3">
                  {status.industries && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Saved</span>
                    </div>
                  )}
                  <Button
                    variant="primary"
                    onClick={saveIndustries}
                    loading={savingIndustries}
                    disabled={selectedIndustryIds.length === 0}
                  >
                    <Save className="h-4 w-4" />
                    Save Industries
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'areas':
        const formatServiceArea = (area: ServiceArea) => {
          const parts = [];

          if (area.type === 'state' && area.entire_state) {
            return `Entire state of ${area.state}`;
          }

          if (area.city_name) parts.push(area.city_name);
          if (area.state) parts.push(area.state);
          if (area.zipcode) parts.push(`ZIP: ${area.zipcode}`);
          if (area.radius_miles) parts.push(`Radius: ${area.radius_miles} miles`);

          return parts.join(', ') || area.value;
        };

        return (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <MapPin className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Service Areas
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Define where you provide services so the AI agent knows your coverage area.
                </p>
              </div>
            </div>

            {serviceAreas.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-green-900 dark:text-green-100">
                      Service areas configured ✓
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {serviceAreas.map((area) => (
                      <div
                        key={area.id}
                        className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {formatServiceArea(area)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Type: {area.type.charAt(0).toUpperCase() + area.type.slice(1)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <a
                      href="/settings/business#service-areas"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                      >
                        Edit Service Areas →
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                      No service areas configured
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                      Add your service areas so the AI agent knows where you provide services.
                    </p>
                    <a
                      href="/settings/business#service-areas"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="primary"
                        size="sm"
                      >
                        Add Service Areas →
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'description':
        return (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <FileText className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  About Your Business
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Help the AI agent introduce your company by providing a brief description.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Include your history, specialties, service area, and what makes you unique.
              </p>

              <Textarea
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="E.g., Family-owned plumbing company serving Miami for 20+ years. We specialize in residential and commercial plumbing repairs, installations, and 24/7 emergency services."
                rows={8}
                maxLength={5000}
                showCharacterCount={true}
                resize="vertical"
                label="Business Description"
              />

              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                {status.businessDescription && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Description saved successfully</span>
                  </div>
                )}
                <div className={status.businessDescription ? '' : 'w-full flex justify-end'}>
                  <Button
                    variant="primary"
                    onClick={saveBusinessDescription}
                    disabled={savingDescription || !businessDescription.trim()}
                    loading={savingDescription}
                  >
                    <Save className="h-4 w-4" />
                    Save Description
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'transfer':
        return (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <Phone className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Transfer Numbers <span className="text-gray-500 text-lg">(Optional)</span>
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Configure phone numbers for the AI agent to transfer calls to your team.
                </p>
              </div>
            </div>

            {transferNumbers.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-green-900 dark:text-green-100">
                      Transfer numbers configured ✓
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {transferNumbers.map((number) => (
                      <div
                        key={number.id}
                        className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {number.label}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {number.phone_number}
                            {number.transfer_type && ` • ${number.transfer_type}`}
                            {number.is_default && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <a
                      href="/voice-ai/transfer-numbers"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                      >
                        Manage Transfer Numbers →
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      No transfer numbers (Optional)
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                      Add transfer numbers if you want the AI agent to transfer calls to your team. This step is optional.
                    </p>
                    <a
                      href="/voice-ai/transfer-numbers"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                      >
                        Add Transfer Numbers →
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'complete':
        return (
          <div className="max-w-2xl mx-auto py-12 text-center space-y-8">
            <CheckCircle className="h-20 w-20 text-green-600 dark:text-green-400 mx-auto" />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {isSetupComplete() ? 'Setup Complete!' : 'Almost There!'}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              {isSetupComplete()
                ? 'Your Voice AI agent is ready to handle calls with complete business context.'
                : 'Complete the remaining required items to finish setup.'}
            </p>

            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-left max-w-md mx-auto">
              <h3 className="font-bold text-lg mb-6 text-gray-900 dark:text-gray-100">
                Setup Status:
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Business Hours', status: status.businessHours, required: true, step: 1 },
                  { label: 'Services', status: status.services, required: true, step: 2 },
                  { label: 'Industries', status: status.industries, required: true, step: 3 },
                  { label: 'Service Areas', status: status.serviceAreas, required: true, step: 4 },
                  { label: 'Business Description', status: status.businessDescription, required: true, step: 5 },
                  { label: 'Transfer Numbers', status: status.transferNumbers, required: false, step: 6 },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setCurrentStep(item.step)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    {item.status ? (
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle
                        className={`h-6 w-6 flex-shrink-0 ${
                          item.required ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'
                        }`}
                      />
                    )}
                    <span className="text-base text-gray-700 dark:text-gray-300">
                      {item.label}
                      {!item.required && ' (Optional)'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ProtectedRoute requiredRole={['Owner', 'Admin']}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/voice-ai/settings')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Voice AI Setup Wizard
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {steps[currentStep].label}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/voice-ai/settings')}>
                Exit Setup
              </Button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between overflow-x-auto">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                  <button
                    key={step.id}
                    onClick={() => handleStepClick(index)}
                    className={`flex flex-col items-center gap-2 min-w-[100px] ${
                      isActive ? 'opacity-100' : 'opacity-60 hover:opacity-80'
                    } transition-opacity`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <StepIcon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium text-center text-gray-700 dark:text-gray-300">
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="py-12 px-6">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>

              <Button
                variant="primary"
                onClick={handleNext}
                disabled={currentStep === steps.length - 1 && !isSetupComplete()}
              >
                {currentStep === steps.length - 1 ? 'Finish Setup' : 'Next'}
                {currentStep < steps.length - 1 && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
