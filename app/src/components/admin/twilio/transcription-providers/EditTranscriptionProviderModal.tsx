'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { UpdateTranscriptionProviderDto, TranscriptionProvider } from '@/lib/types/twilio-admin';

interface EditTranscriptionProviderModalProps {
  open: boolean;
  onClose: () => void;
  provider: TranscriptionProvider | null;
  onUpdate: (id: string, data: UpdateTranscriptionProviderDto) => Promise<void>;
}

export function EditTranscriptionProviderModal({
  open,
  onClose,
  provider,
  onUpdate,
}: EditTranscriptionProviderModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [language, setLanguage] = useState('');
  const [costPerMinute, setCostPerMinute] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSystemDefault, setIsSystemDefault] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (provider) {
      setApiEndpoint(provider.api_endpoint || '');
      setModel(provider.model || '');
      setLanguage(provider.language || '');
      setCostPerMinute(String(provider.cost_per_minute));
      setUsageLimit(String(provider.usage_limit));
      setStatus(provider.status);
      setIsSystemDefault(provider.is_system_default);
    }
  }, [provider]);

  const handleUpdate = async () => {
    if (!provider) return;

    setUpdating(true);
    try {
      const dto: UpdateTranscriptionProviderDto = {};

      if (apiKey) dto.api_key = apiKey;
      if (apiEndpoint !== provider.api_endpoint) dto.api_endpoint = apiEndpoint || undefined;
      if (model !== provider.model) dto.model = model || undefined;
      if (language !== provider.language) dto.language = language || undefined;
      if (parseFloat(costPerMinute) !== parseFloat(provider.cost_per_minute)) dto.cost_per_minute = parseFloat(costPerMinute);
      if (parseInt(usageLimit) !== provider.usage_limit) dto.usage_limit = parseInt(usageLimit);
      if (status !== provider.status) dto.status = status;
      if (isSystemDefault !== provider.is_system_default) dto.is_system_default = isSystemDefault;

      await onUpdate(provider.id, dto);
      onClose();
      setApiKey('');
    } catch (error) {
      // Error handled by parent
    } finally {
      setUpdating(false);
    }
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transcription Provider</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">Provider</p>
            <p className="text-lg font-semibold">{provider.provider_name}</p>
          </div>

          <div>
            <Label htmlFor="apiKey">API Key (leave empty to keep current)</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter new API key to update"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be encrypted before storage
            </p>
          </div>

          <div>
            <Label htmlFor="apiEndpoint">API Endpoint</Label>
            <Input
              id="apiEndpoint"
              type="url"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://api.openai.com/v1/audio/transcriptions"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="whisper-1"
              />
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="costPerMinute">Cost per Minute (USD)</Label>
              <Input
                id="costPerMinute"
                type="number"
                step="0.0001"
                value={costPerMinute}
                onChange={(e) => setCostPerMinute(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="usageLimit">Monthly Usage Limit</Label>
              <Input
                id="usageLimit"
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Set as System Default</Label>
              <p className="text-xs text-muted-foreground">
                This provider will be used for all new transcriptions
              </p>
            </div>
            <Switch
              checked={isSystemDefault}
              onCheckedChange={setIsSystemDefault}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={onClose} variant="outline" disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? 'Updating...' : 'Update Provider'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
