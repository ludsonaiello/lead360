'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Mic, Radio, AudioLines, CheckCircle2, XCircle } from 'lucide-react';
import type { TranscriptionProvider } from '@/lib/types/twilio-admin';

interface TranscriptionProviderCardProps {
  provider: TranscriptionProvider;
  onTest: (id: string) => void;
  onEdit: (id: string) => void;
  onMakeDefault: (id: string) => void;
  onDelete: (id: string) => void;
}

function getProviderIcon(name: string) {
  switch (name) {
    case 'openai_whisper':
      return <Mic className="h-5 w-5" />;
    case 'deepgram':
      return <Radio className="h-5 w-5" />;
    case 'assemblyai':
      return <AudioLines className="h-5 w-5" />;
    default:
      return <Mic className="h-5 w-5" />;
  }
}

function getProviderDisplayName(name: string): string {
  switch (name) {
    case 'openai_whisper':
      return 'OpenAI Whisper';
    case 'deepgram':
      return 'Deepgram';
    case 'assemblyai':
      return 'AssemblyAI';
    default:
      return name;
  }
}

export function TranscriptionProviderCard({
  provider,
  onTest,
  onEdit,
  onMakeDefault,
  onDelete,
}: TranscriptionProviderCardProps) {
  const usagePercentage = (provider.usage_current / provider.usage_limit) * 100;
  const isHealthy = parseFloat(provider.statistics.success_rate) >= 95;

  return (
    <Card className={provider.is_system_default ? 'border-primary' : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getProviderIcon(provider.provider_name)}
              {getProviderDisplayName(provider.provider_name)}
              {provider.is_system_default && (
                <Badge variant="default">System Default</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Model: {provider.model || 'Default'}
            </p>
          </div>
          <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
            {provider.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Usage</span>
            <span className="text-muted-foreground">
              {provider.usage_current.toLocaleString()} / {provider.usage_limit.toLocaleString()}
            </span>
          </div>
          <Progress
            value={usagePercentage}
            className={usagePercentage > 90 ? 'bg-destructive' : undefined}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {usagePercentage.toFixed(1)}% of monthly limit
          </p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-lg font-semibold flex items-center gap-1">
              {isHealthy ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              {provider.statistics.success_rate}%
            </p>
            <p className="text-xs text-muted-foreground">
              {provider.statistics.successful.toLocaleString()} /{' '}
              {provider.statistics.total_transcriptions.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Cost</p>
            <p className="text-lg font-semibold">{provider.statistics.total_cost}</p>
            <p className="text-xs text-muted-foreground">
              ${parseFloat(provider.cost_per_minute).toFixed(4)}/min
            </p>
          </div>
        </div>

        {/* Language & Endpoint */}
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Language:</span>
            <span>{provider.language || 'Auto-detect'}</span>
          </div>
          {provider.tenant && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tenant:</span>
              <span>{provider.tenant.company_name}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => onTest(provider.id)}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            Test
          </Button>
          <Button
            onClick={() => onEdit(provider.id)}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            Edit
          </Button>
          {!provider.is_system_default && (
            <Button
              onClick={() => onMakeDefault(provider.id)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Make Default
            </Button>
          )}
          <Button
            onClick={() => onDelete(provider.id)}
            variant="destructive"
            size="sm"
            disabled={provider.is_system_default}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
