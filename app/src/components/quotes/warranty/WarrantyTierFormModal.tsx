'use client';

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import MoneyInput from '@/components/ui/MoneyInput';
import { createWarrantyTier, updateWarrantyTier } from '@/lib/api/warranty-tiers';
import type { WarrantyTier } from '@/lib/types/quotes';

interface WarrantyTierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  tier?: WarrantyTier | null;
}

export default function WarrantyTierFormModal({
  isOpen,
  onClose,
  onSuccess,
  tier,
}: WarrantyTierFormModalProps) {
  const [tierName, setTierName] = useState('');
  const [description, setDescription] = useState('');
  const [priceType, setPriceType] = useState<'fixed' | 'percentage'>('fixed');
  const [priceValue, setPriceValue] = useState<number>(0);
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!tier;

  useEffect(() => {
    if (tier) {
      setTierName(tier.tier_name);
      setDescription(tier.description || '');
      setPriceType(tier.price_type);
      setPriceValue(tier.price_value);
      setDurationMonths(tier.duration_months);
      setIsActive(tier.is_active);
    } else {
      setTierName('');
      setDescription('');
      setPriceType('fixed');
      setPriceValue(0);
      setDurationMonths(12);
      setIsActive(true);
    }
    setError(null);
  }, [tier, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validation
      if (durationMonths < 1 || durationMonths > 600) {
        setError('Duration must be between 1 and 600 months (1-50 years)');
        setLoading(false);
        return;
      }

      if (priceValue < 0) {
        setError('Price value must be greater than or equal to 0');
        setLoading(false);
        return;
      }

      if (priceType === 'percentage' && priceValue > 100) {
        setError('Percentage cannot exceed 100%');
        setLoading(false);
        return;
      }

      if (isEditing && tier) {
        await updateWarrantyTier(tier.id, {
          tier_name: tierName.trim(),
          description: description.trim() || undefined,
          price_type: priceType,
          price_value: priceValue,
          duration_months: durationMonths,
          is_active: isActive,
        });
      } else {
        await createWarrantyTier({
          tier_name: tierName.trim(),
          description: description.trim() || undefined,
          price_type: priceType,
          price_value: priceValue,
          duration_months: durationMonths,
        });
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('Warranty tier form error:', err);
      setError(err.response?.data?.message || 'Failed to save warranty tier');
    } finally {
      setLoading(false);
    }
  };

  const formatDurationDisplay = (months: number): string => {
    if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
    const years = (months / 12).toFixed(1);
    return `Equivalent to ${years} year${years === '1.0' ? '' : 's'}`;
  };

  const calculateWarrantyPrice = (itemPrice: number = 10000): string => {
    if (priceType === 'fixed') {
      return `$${priceValue.toFixed(2)}`;
    } else {
      const calculated = (itemPrice * priceValue) / 100;
      return `$${calculated.toFixed(2)} (${priceValue}% of $${itemPrice.toLocaleString()})`;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Warranty Tier' : 'Create Warranty Tier'}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Tier Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tier Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={tierName}
                onChange={(e) => setTierName(e.target.value)}
                placeholder="e.g., 1-Year Standard, 3-Year Premium"
                maxLength={100}
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this warranty covers..."
                rows={3}
                maxLength={500}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description.length}/500 characters
              </p>
            </div>

            {/* Price Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Price Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    priceType === 'fixed'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    value="fixed"
                    checked={priceType === 'fixed'}
                    onChange={() => setPriceType('fixed')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-gray-900 dark:text-white">Fixed Price</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Dollar amount (e.g., $199.99)
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    priceType === 'percentage'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    value="percentage"
                    checked={priceType === 'percentage'}
                    onChange={() => setPriceType('percentage')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-gray-900 dark:text-white">Percentage</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      % of item price (e.g., 15%)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Price Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price Value <span className="text-red-500">*</span>
              </label>
              {priceType === 'fixed' ? (
                <MoneyInput
                  value={priceValue}
                  onChange={setPriceValue}
                  placeholder="$0.00"
                  required
                />
              ) : (
                <div className="relative">
                  <Input
                    type="number"
                    value={priceValue}
                    onChange={(e) => setPriceValue(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (Months) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={durationMonths}
                onChange={(e) => setDurationMonths(parseInt(e.target.value) || 0)}
                placeholder="12"
                min="1"
                max="600"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatDurationDisplay(durationMonths)}
              </p>
            </div>

            {/* Price Preview */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                Price Preview (for $10,000 item):
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {calculateWarrantyPrice(10000)}
              </p>
            </div>

            {/* Active Toggle (only for editing) */}
            {isEditing && (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Active Status
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Inactive tiers won't appear in warranty selection
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Usage Warning (for editing) */}
            {isEditing && tier && tier.usage_count > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This warranty tier is currently used on {tier.usage_count}{' '}
                  {tier.usage_count === 1 ? 'item' : 'items'}. Changes will affect all items using this tier.
                </p>
              </div>
            )}
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!tierName.trim() || priceValue < 0 || durationMonths < 1}
          >
            {!loading && <Save className="w-4 h-4" />}
            {isEditing ? 'Save Changes' : 'Create Warranty Tier'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
