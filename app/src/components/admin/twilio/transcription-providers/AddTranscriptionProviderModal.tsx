'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { CreateTranscriptionProviderDto, Tenant } from '@/lib/types/twilio-admin';

interface AddTranscriptionProviderModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateTranscriptionProviderDto) => Promise<void>;
  tenants: Tenant[];
}

export function AddTranscriptionProviderModal({
  open,
  onClose,
  onCreate,
  tenants,
}: AddTranscriptionProviderModalProps) {
  const [providerName, setProviderName] = useState<'openai_whisper' | 'deepgram' | 'assemblyai'>('openai_whisper');
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [model, setModel] = useState('whisper-1');
  const [language, setLanguage] = useState('');
  const [costPerMinute, setCostPerMinute] = useState('0.006');
  const [usageLimit, setUsageLimit] = useState('10000');
  const [isSystemDefault, setIsSystemDefault] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [creating, setCreating] = useState(false);

  // Update default model when provider changes
  const handleProviderChange = (newProvider: 'openai_whisper' | 'deepgram' | 'assemblyai') => {
    setProviderName(newProvider);
    // Set default model for OpenAI, clear for others
    if (newProvider === 'openai_whisper') {
      setModel('whisper-1');
    } else {
      setModel('');
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreate({
        provider_name: providerName,
        api_key: apiKey,
        api_endpoint: apiEndpoint || undefined,
        model: model || undefined,
        language: language || undefined,
        cost_per_minute: parseFloat(costPerMinute),
        usage_limit: parseInt(usageLimit),
        is_system_default: isSystemDefault,
        tenant_id: tenantId || undefined,
      });
      onClose();
      // Reset form
      setProviderName('openai_whisper');
      setApiKey('');
      setApiEndpoint('');
      setModel('whisper-1');
      setLanguage('');
      setCostPerMinute('0.006');
      setUsageLimit('10000');
      setIsSystemDefault(false);
      setTenantId('');
    } catch (error) {
      // Error handled by parent
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transcription Provider</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="providerName">Provider</Label>
            <Select
              value={providerName}
              onValueChange={(v) => handleProviderChange(v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai_whisper">OpenAI Whisper</SelectItem>
                <SelectItem value="deepgram">Deepgram</SelectItem>
                <SelectItem value="assemblyai">AssemblyAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-proj-..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be encrypted before storage
            </p>
          </div>

          <div>
            <Label htmlFor="apiEndpoint">API Endpoint (Optional)</Label>
            <Input
              id="apiEndpoint"
              type="url"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://api.openai.com/v1/audio/transcriptions"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to use default endpoint
            </p>
          </div>

          <div>
            <Label htmlFor="model">Model</Label>
            {providerName === 'openai_whisper' ? (
              <>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whisper-1">whisper-1 (Classic Whisper)</SelectItem>
                    <SelectItem value="gpt-4o-transcribe">gpt-4o-transcribe (Fast)</SelectItem>
                    <SelectItem value="gpt-4o-transcribe-diarize">gpt-4o-transcribe-diarize (Speaker Detection)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  GPT-4o models support speaker diarization
                </p>
              </>
            ) : (
              <>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model name (optional)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to use provider default
                </p>
              </>
            )}
          </div>

          <div>
            <Label htmlFor="language">Language (Optional)</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="en"
            />
            <p className="text-xs text-muted-foreground mt-1">
              ISO 639-1 code (e.g., en, es, fr). Leave empty for auto-detect.
            </p>
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
                placeholder="0.006"
              />
            </div>
            <div>
              <Label htmlFor="usageLimit">Monthly Usage Limit</Label>
              <Input
                id="usageLimit"
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="10000"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tenant">Tenant (Optional)</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger>
                <SelectValue placeholder="System-wide (no tenant)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">System-wide</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.company_name}
                  </SelectItem>
                ))}
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
            <Button onClick={onClose} variant="secondary" disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !apiKey}>
              {creating ? 'Creating...' : 'Create Provider'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
