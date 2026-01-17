/**
 * Edit Lead Page
 * Edit existing lead basic information
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getLeadById, updateLead } from '@/lib/api/leads';
import type { Lead } from '@/lib/types/leads';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';

// Edit schema (only basic info - contact methods edited on details page)
const editLeadSchema = z.object({
  first_name: z.string().min(1, 'First name required').max(100),
  last_name: z.string().min(1, 'Last name required').max(100),
  language_spoken: z.string().optional(),
  accept_sms: z.boolean().optional(),
  preferred_communication: z.enum(['email', 'phone', 'sms']).optional(),
});

type EditLeadFormData = z.infer<typeof editLeadSchema>;

export default function EditLeadPage() {
  const router = useRouter();
  const params = useParams();
  const { canPerform } = useRBAC();
  const leadId = params?.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EditLeadFormData>({
    resolver: zodResolver(editLeadSchema),
  });

  const canEdit = canPerform('leads', 'edit');

  useEffect(() => {
    if (leadId) {
      loadLead();
    }
  }, [leadId]);

  const loadLead = async () => {
    try {
      setLoading(true);
      const data = await getLeadById(leadId);
      setLead(data);

      // Pre-fill form
      reset({
        first_name: data.first_name,
        last_name: data.last_name,
        language_spoken: data.language_spoken || 'EN',
        accept_sms: data.accept_sms,
        preferred_communication: data.preferred_communication || 'email',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load lead');
      router.push('/leads');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: EditLeadFormData) => {
    try {
      setSaving(true);
      await updateLead(leadId, data);
      toast.success('Lead updated successfully!');
      router.push(`/leads/${leadId}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to edit leads.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-500" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Lead Not Found</h1>
          <Link href="/leads">
            <Button variant="ghost">Back to Leads</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/leads/${leadId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-5 h-5" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Edit Lead
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {lead.first_name} {lead.last_name}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> To edit contact methods (emails, phones, addresses) or add service requests,
          please use the lead details page.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('first_name')}
                type="text"
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  placeholder:text-gray-400 dark:placeholder:text-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="John"
              />
              {errors.first_name && (
                <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('last_name')}
                type="text"
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  placeholder:text-gray-400 dark:placeholder:text-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Doe"
              />
              {errors.last_name && (
                <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Language Spoken
              </label>
              <select
                {...register('language_spoken')}
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="EN">English</option>
                <option value="ES">Spanish</option>
                <option value="PT">Portuguese</option>
                <option value="FR">French</option>
                <option value="DE">German</option>
                <option value="ZH">Chinese</option>
                <option value="JA">Japanese</option>
                <option value="KO">Korean</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Preferred Communication
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    {...register('preferred_communication')}
                    type="radio"
                    value="email"
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    {...register('preferred_communication')}
                    type="radio"
                    value="phone"
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Phone</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    {...register('preferred_communication')}
                    type="radio"
                    value="sms"
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">SMS</span>
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('accept_sms')}
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Accept SMS notifications
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 justify-end">
          <Link href={`/leads/${leadId}`}>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
