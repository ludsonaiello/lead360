/**
 * Approval Threshold Configuration Page
 * Configure multi-level approval thresholds for quotes
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import {
  Save,
  Plus,
  Trash2,
  Shield,
  AlertCircle,
  Info,
  DollarSign,
  User,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import {
  getApprovalThresholds,
  updateApprovalThresholds,
  transformLevelsToThresholds,
  type ApprovalLevel,
  type ApprovalThreshold,
} from '@/lib/api/quote-approvals';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ThresholdFormData {
  level: number;
  amount: string;
  approver_role: string;
}

export default function ApprovalThresholdsPage() {
  const router = useRouter();
  const [thresholds, setThresholds] = useState<ThresholdFormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, { amount?: string; approver_role?: string }>>({});

  // Modal states
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Available roles for approval
  const availableRoles = ['Manager', 'Admin', 'Owner'];

  // Modal helper functions
  const showSuccess = () => {
    setSuccessModalOpen(true);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalOpen(true);
  };

  // Load thresholds
  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    setLoading(true);
    try {
      const data = await getApprovalThresholds();

      // API returns direct array or null
      if (data && Array.isArray(data) && data.length > 0) {
        const formData: ThresholdFormData[] = data.map((level) => ({
          level: level.level,
          amount: level.amount.toString(),
          approver_role: level.approver_role,
        }));
        setThresholds(formData);
      } else {
        // No thresholds configured = approval workflow disabled (this is valid)
        setThresholds([]);
      }
    } catch (error: any) {
      console.error('Failed to load thresholds:', error);
      showError('Could not load approval thresholds. Please try again.');
      // Set empty on error
      setThresholds([]);
    } finally {
      setLoading(false);
    }
  };

  // Add new threshold level
  const addLevel = () => {
    if (thresholds.length >= 5) {
      showError('Maximum levels reached. You can configure up to 5 approval levels.');
      return;
    }

    const lastAmount = thresholds.length > 0
      ? parseFloat(thresholds[thresholds.length - 1].amount)
      : 0;

    setThresholds([
      ...thresholds,
      {
        level: thresholds.length + 1,
        amount: (lastAmount + 10000).toString(),
        approver_role: 'Admin',
      }
    ]);
  };

  // Remove threshold level
  const removeLevel = (index: number) => {
    const newThresholds = thresholds.filter((_, i) => i !== index);
    // Re-number levels
    newThresholds.forEach((t, i) => {
      t.level = i + 1;
    });
    setThresholds(newThresholds);

    // Clear errors for this level
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  // Update threshold field
  const updateThreshold = (index: number, field: keyof ThresholdFormData, value: string) => {
    const newThresholds = [...thresholds];
    newThresholds[index] = { ...newThresholds[index], [field]: value };
    setThresholds(newThresholds);

    // Clear error for this field
    if (errors[index]) {
      const newErrors = { ...errors };
      if (newErrors[index]) {
        delete newErrors[index][field as keyof typeof newErrors[number]];
        if (Object.keys(newErrors[index]).length === 0) {
          delete newErrors[index];
        }
      }
      setErrors(newErrors);
    }
  };

  // Validate form
  const validate = (): boolean => {
    // Empty thresholds = disabled approval workflow (valid state)
    if (thresholds.length === 0) {
      setErrors({});
      return true;
    }

    const newErrors: Record<number, { amount?: string; approver_role?: string }> = {};
    let isValid = true;

    thresholds.forEach((threshold, index) => {
      const levelErrors: { amount?: string; approver_role?: string } = {};

      // Validate amount
      const amount = parseFloat(threshold.amount);
      if (isNaN(amount) || amount <= 0) {
        levelErrors.amount = 'Amount must be greater than 0';
        isValid = false;
      }

      // Check ascending order
      if (index > 0) {
        const prevAmount = parseFloat(thresholds[index - 1].amount);
        if (amount <= prevAmount) {
          levelErrors.amount = 'Amount must be greater than previous level';
          isValid = false;
        }
      }

      // Validate role
      if (!threshold.approver_role || !availableRoles.includes(threshold.approver_role)) {
        levelErrors.approver_role = 'Please select a valid role';
        isValid = false;
      }

      if (Object.keys(levelErrors).length > 0) {
        newErrors[index] = levelErrors;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  // Save thresholds
  const handleSave = async () => {
    if (!validate()) {
      showError('Please fix the validation errors before saving.');
      return;
    }

    setSaving(true);

    try {
      // Transform to PATCH format
      const patchData: ApprovalThreshold[] = thresholds.map(t => ({
        level: t.level,
        amount: parseFloat(t.amount),
        approver_role: t.approver_role,
      }));

      await updateApprovalThresholds({ thresholds: patchData });

      // Reload to get server state
      await loadThresholds();

      // Show success modal
      showSuccess();
    } catch (error: any) {
      console.error('Failed to save thresholds:', error);
      showError(error.response?.data?.message || 'Failed to update approval thresholds. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Format currency display
  const formatCurrency = (amount: string): string => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '$0';
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/settings/quotes')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quote Settings
        </Button>
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Approval Thresholds
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Configure multi-level approval requirements based on quote amounts
        </p>
      </div>

      {/* Info Box */}
      <Card className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              How Approval Thresholds Work
            </p>
            <ul className="text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li><strong>No thresholds configured</strong> = All quotes are automatically approved (approval workflow disabled)</li>
              <li>Quotes are automatically routed based on their total amount</li>
              <li>Approvals must be completed sequentially (Level 1, then Level 2, etc.)</li>
              <li>Each level requires approval from a user with the specified role</li>
              <li>Owner role can bypass all approval levels</li>
              <li>You can configure up to 5 approval levels</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Thresholds Configuration */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Approval Levels
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={addLevel}
            disabled={thresholds.length >= 5}
          >
            <Plus className="w-4 h-4" />
            Add Level
          </Button>
        </div>

        {/* No Thresholds State */}
        {thresholds.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                Approval Workflow Disabled
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                No approval thresholds are configured. All quotes will be automatically approved when submitted.
                Add approval levels to enable the workflow.
              </p>
              <Button
                type="button"
                variant="primary"
                onClick={addLevel}
              >
                <Plus className="w-4 h-4" />
                Add First Approval Level
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Threshold List */}
            <div className="space-y-4">
              {thresholds.map((threshold, index) => {
            const nextThreshold = thresholds[index + 1];
            const minAmount = index === 0 ? 0 : parseFloat(thresholds[index - 1].amount);
            const maxAmount = parseFloat(threshold.amount);

            return (
              <div
                key={index}
                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Level Badge */}
                  <div className="flex-shrink-0">
                    <Badge variant="info" className="text-lg px-3 py-1">
                      Level {threshold.level}
                    </Badge>
                  </div>

                  {/* Form Fields */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Amount Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <DollarSign className="w-4 h-4 inline mr-1" />
                        Maximum Amount *
                      </label>
                      <Input
                        type="number"
                        value={threshold.amount}
                        onChange={(e) => updateThreshold(index, 'amount', e.target.value)}
                        placeholder="10000"
                        error={errors[index]?.amount}
                        min="0"
                        step="1000"
                      />
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Quotes {formatCurrency(minAmount.toString())} - {formatCurrency(threshold.amount)}
                        {!nextThreshold && ' and above'}
                      </p>
                    </div>

                    {/* Role Select */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <User className="w-4 h-4 inline mr-1" />
                        Approver Role *
                      </label>
                      <select
                        value={threshold.approver_role}
                        onChange={(e) => updateThreshold(index, 'approver_role', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                          errors[index]?.approver_role
                            ? 'border-red-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <option value="">Select Role</option>
                        {availableRoles.map(role => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      {errors[index]?.approver_role && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {errors[index].approver_role}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLevel(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visual Flow Preview */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Approval Flow Preview
          </h3>
          <div className="flex items-center gap-2 overflow-x-auto">
            {thresholds.map((threshold, index) => (
              <React.Fragment key={index}>
                <div className="flex flex-col items-center min-w-[120px]">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-600 dark:border-blue-400 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-2">
                    {threshold.approver_role}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {formatCurrency(threshold.amount)}
                    {index === thresholds.length - 1 && '+'}
                  </p>
                </div>
                {index < thresholds.length - 1 && (
                  <div className="w-8 h-0.5 bg-blue-300 dark:bg-blue-700 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Warning about changes */}
        <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Changes to approval thresholds will only affect new quotes. Existing quotes in the approval process will continue with their original threshold configuration.
            </p>
          </div>
        </div>
        </>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="ghost"
            onClick={loadThresholds}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            {thresholds.length === 0 ? 'Disable Approval Workflow' : 'Save Thresholds'}
          </Button>
        </div>
      </Card>

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Settings Saved"
        size="sm"
      >
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-gray-900 dark:text-gray-100 font-medium">
              {thresholds.length === 0
                ? 'Approval workflow has been disabled.'
                : 'Approval thresholds have been updated successfully.'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {thresholds.length === 0
                ? 'All quotes will be automatically approved when submitted.'
                : 'Changes will apply to new quotes going forward.'}
            </p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="primary" onClick={() => setSuccessModalOpen(false)}>
            Done
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        size="sm"
      >
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-gray-900 dark:text-gray-100 font-medium">
              {errorMessage}
            </p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="primary" onClick={() => setErrorModalOpen(false)}>
            OK
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
