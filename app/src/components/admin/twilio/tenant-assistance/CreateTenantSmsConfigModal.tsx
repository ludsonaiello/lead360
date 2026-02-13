'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { CreateTenantSmsConfigDto, PhoneNumber } from '@/lib/types/twilio-admin';

interface CreateTenantSmsConfigModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  availablePhoneNumbers: PhoneNumber[];
  onCreate: (data: CreateTenantSmsConfigDto) => Promise<void>;
}

export function CreateTenantSmsConfigModal({
  open,
  onClose,
  tenantId,
  tenantName,
  availablePhoneNumbers,
  onCreate,
}: CreateTenantSmsConfigModalProps) {
  const [providerType, setProviderType] = useState<'system' | 'custom'>('system');
  const [fromPhone, setFromPhone] = useState('');
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreate({
        provider_type: providerType,
        from_phone: fromPhone,
        account_sid: providerType === 'custom' ? accountSid : undefined,
        auth_token: providerType === 'custom' ? authToken : undefined,
      });
      onClose();
      // Reset form
      setProviderType('system');
      setFromPhone('');
      setAccountSid('');
      setAuthToken('');
    } catch (error) {
      // Error handled by parent
    } finally {
      setCreating(false);
    }
  };

  const availableNumbers = availablePhoneNumbers.filter((p) => p.status === 'available');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create SMS Config for {tenantName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Provider Type</Label>
            <RadioGroup
              value={providerType}
              onValueChange={(v) => setProviderType(v as any)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="system" />
                <Label htmlFor="system" className="cursor-pointer">
                  <div>
                    <p className="font-medium">System Provider (Model B)</p>
                    <p className="text-xs text-muted-foreground">
                      Use platform's Twilio account
                    </p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="cursor-pointer">
                  <div>
                    <p className="font-medium">Custom Provider (Model A)</p>
                    <p className="text-xs text-muted-foreground">
                      Tenant's own Twilio account
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {providerType === 'system' ? (
            <div>
              <Label htmlFor="fromPhone">Select Phone Number</Label>
              <Select value={fromPhone} onValueChange={setFromPhone}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an available number" />
                </SelectTrigger>
                <SelectContent>
                  {availableNumbers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No available numbers
                    </SelectItem>
                  ) : (
                    availableNumbers.map((number) => (
                      <SelectItem key={number.sid} value={number.phone_number}>
                        {number.friendly_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Only showing available numbers from system pool
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="fromPhone">From Phone Number</Label>
                <Input
                  id="fromPhone"
                  type="tel"
                  value={fromPhone}
                  onChange={(e) => setFromPhone(e.target.value)}
                  placeholder="+15555555555"
                />
              </div>
              <div>
                <Label htmlFor="accountSid">Twilio Account SID</Label>
                <Input
                  id="accountSid"
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <Label htmlFor="authToken">Twilio Auth Token</Label>
                <Input
                  id="authToken"
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Enter tenant's auth token"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Will be encrypted before storage
                </p>
              </div>
            </>
          )}

          <Alert>
            <AlertTitle>Admin Action</AlertTitle>
            <AlertDescription>
              You are creating this configuration on behalf of the tenant. This action will be
              logged.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={onClose} variant="secondary" disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !fromPhone}>
              {creating ? 'Creating...' : 'Create Configuration'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
