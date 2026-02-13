/**
 * TenantConfigCard Component
 * Display summary of tenant communication configuration
 */

'use client';

import { Building2, MessageSquare, Phone, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { TenantSMSConfig, TenantWhatsAppConfig, TenantIVRConfig } from '@/lib/types/twilio-admin';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface TenantConfigCardProps {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  smsConfig?: TenantSMSConfig;
  whatsappConfig?: TenantWhatsAppConfig;
  ivrConfig?: TenantIVRConfig;
  onViewDetails: () => void;
}

function ConfigStatus({ isActive, isVerified }: { isActive?: boolean; isVerified?: boolean }) {
  if (isActive && isVerified) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-medium">Active</span>
      </span>
    );
  }
  if (isActive && !isVerified) {
    return (
      <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-medium">Pending Verification</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
      <XCircle className="h-4 w-4" />
      <span className="text-xs font-medium">Inactive</span>
    </span>
  );
}

export function TenantConfigCard({
  tenantId,
  tenantName,
  subdomain,
  smsConfig,
  whatsappConfig,
  ivrConfig,
  onViewDetails,
}: TenantConfigCardProps) {
  const router = useRouter();

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{tenantName}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{subdomain}</p>
          </div>
        </div>
      </div>

      {/* Configurations Summary */}
      <div className="space-y-3 mb-4">
        {/* SMS Config */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">SMS</span>
          </div>
          {smsConfig ? (
            <div className="flex items-center gap-2">
              <ConfigStatus isActive={smsConfig.is_active} isVerified={smsConfig.is_verified} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{smsConfig.from_phone}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">Not configured</span>
          )}
        </div>

        {/* WhatsApp Config */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">WhatsApp</span>
          </div>
          {whatsappConfig ? (
            <div className="flex items-center gap-2">
              <ConfigStatus isActive={whatsappConfig.is_active} isVerified={whatsappConfig.is_verified} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{whatsappConfig.from_phone}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">Not configured</span>
          )}
        </div>

        {/* IVR Config */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">IVR</span>
          </div>
          {ivrConfig ? (
            <ConfigStatus isActive={ivrConfig.ivr_enabled} isVerified={true} />
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">Not configured</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="primary"
          size="sm"
          onClick={onViewDetails}
          className="w-full flex items-center justify-center gap-2"
        >
          View Details
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
