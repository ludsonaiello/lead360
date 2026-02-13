'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Phone, Edit2, TestTube2, Power, Star } from 'lucide-react';
import type { TenantSMSConfig, TenantWhatsAppConfig } from '@/lib/types/twilio-admin';

interface TenantConfigCardProps {
  config: TenantSMSConfig | TenantWhatsAppConfig;
  type: 'sms' | 'whatsapp';
  onTest: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}

export function TenantConfigCard({
  config,
  type,
  onTest,
  onEdit,
  onToggleActive,
}: TenantConfigCardProps) {
  return (
    <Card className={`${config.is_primary ? 'border-2 border-blue-500' : 'border-gray-200 dark:border-gray-700'} shadow-md hover:shadow-lg transition-shadow`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {type === 'sms' ? (
              <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <Phone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            )}
            <CardTitle className="text-lg font-bold">
              {type === 'sms' ? 'SMS' : 'WhatsApp'} Configuration
            </CardTitle>
            {config.is_primary && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          <Badge 
            variant={config.is_active ? 'default' : 'secondary'}
            className={config.is_active ? 'bg-green-600' : 'bg-gray-400'}
          >
            {config.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-3 text-sm bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Phone Number</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{config.from_phone}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Provider Type</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {config.provider_type === 'system' ? 'System' : 'Custom'}
            </Badge>
          </div>
          {config.is_verified !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Verification</span>
              <Badge variant={config.is_verified ? 'default' : 'secondary'}>
                {config.is_verified ? 'Verified' : 'Pending'}
              </Badge>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button 
            onClick={onTest} 
            variant="secondary" 
            size="sm" 
            className="flex items-center justify-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <TestTube2 className="h-4 w-4" />
            Test
          </Button>
          <Button 
            onClick={onEdit} 
            variant="secondary" 
            size="sm" 
            className="flex items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
          <Button
            onClick={onToggleActive}
            variant={config.is_active ? 'destructive' : 'default'}
            size="sm"
            className="flex items-center justify-center gap-1.5"
          >
            <Power className="h-4 w-4" />
            {config.is_active ? 'Off' : 'On'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
