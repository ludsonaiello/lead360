'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { UpdateTenantSmsConfigDto, TenantSMSConfig } from '@/lib/types/twilio-admin';

interface EditTenantSmsConfigModalProps {
  open: boolean;
  onClose: () => void;
  config: TenantSMSConfig;
  tenantName: string;
  onUpdate: (configId: string, data: UpdateTenantSmsConfigDto) => Promise<void>;
}

export function EditTenantSmsConfigModal({
  open,
  onClose,
  config,
  tenantName,
  onUpdate,
}: EditTenantSmsConfigModalProps) {
  const [fromPhone, setFromPhone] = useState(config.from_phone);
  const [isActive, setIsActive] = useState(config.is_active);
  const [accountSid, setAccountSid] = useState(config.account_sid || '');
  const [authToken, setAuthToken] = useState('');
  const [updating, setUpdating] = useState(false);

  // Reset form when config changes or modal opens
  useEffect(() => {
    if (open) {
      setFromPhone(config.from_phone);
      setIsActive(config.is_active);
      setAccountSid(config.account_sid || '');
      setAuthToken(''); // Never pre-fill auth token for security
    }
  }, [open, config]);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const updateData: UpdateTenantSmsConfigDto = {
        is_active: isActive,
      };

      // Only include fields that changed or are being updated
      if (fromPhone !== config.from_phone) {
        updateData.from_phone = fromPhone;
      }

      // For custom provider, allow updating credentials
      if (config.provider_type === 'custom') {
        if (accountSid && accountSid !== config.account_sid) {
          updateData.account_sid = accountSid;
        }
        if (authToken) {
          updateData.auth_token = authToken;
        }
      }

      await onUpdate(config.id, updateData);
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setUpdating(false);
    }
  };

  const isCustomProvider = config.provider_type === 'custom';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit SMS Configuration for {tenantName}
            <Badge variant={config.is_primary ? 'default' : 'secondary'} className="ml-2">
              {config.is_primary ? 'Primary' : 'Secondary'}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Provider Type Info */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Provider Type</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {isCustomProvider ? "Tenant's own Twilio account (Model A)" : "Platform's Twilio account (Model B)"}
                </p>
              </div>
              <Badge variant="secondary" className="font-mono">
                {isCustomProvider ? 'Custom' : 'System'}
              </Badge>
            </div>
          </div>

          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div>
              <Label htmlFor="isActive" className="text-base font-medium">Active Status</Label>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Enable or disable this SMS configuration
              </p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Phone Number */}
          <div>
            <Label htmlFor="fromPhone">From Phone Number</Label>
            <Input
              id="fromPhone"
              type="tel"
              value={fromPhone}
              onChange={(e) => setFromPhone(e.target.value)}
              placeholder="+15555555555"
              disabled={!isCustomProvider} // System provider numbers can't be changed here
            />
            {!isCustomProvider && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                System provider numbers cannot be changed here. Contact admin to reassign.
              </p>
            )}
          </div>

          {/* Custom Provider Credentials */}
          {isCustomProvider && (
            <>
              <div>
                <Label htmlFor="accountSid">Twilio Account SID</Label>
                <Input
                  id="accountSid"
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Leave blank to keep existing credentials
                </p>
              </div>
              <div>
                <Label htmlFor="authToken">Twilio Auth Token</Label>
                <Input
                  id="authToken"
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Enter new auth token (optional)"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Only enter if updating credentials. Will be encrypted before storage.
                </p>
              </div>
            </>
          )}

          {/* Verification Status */}
          {config.is_verified !== undefined && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Verification Status</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    {config.is_verified ? 'This configuration is verified and ready to use' : 'Verification pending'}
                  </p>
                </div>
                <Badge variant={config.is_verified ? 'default' : 'secondary'}>
                  {config.is_verified ? 'Verified' : 'Pending'}
                </Badge>
              </div>
            </div>
          )}

          <Alert>
            <AlertTitle>Admin Action</AlertTitle>
            <AlertDescription>
              You are updating this configuration on behalf of the tenant. This action will be logged.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={onClose} variant="secondary" disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? 'Updating...' : 'Update Configuration'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
