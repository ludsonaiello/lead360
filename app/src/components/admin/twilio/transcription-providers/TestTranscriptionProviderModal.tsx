'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { TranscriptionProvider, TestTranscriptionResult } from '@/lib/types/twilio-admin';

interface TestTranscriptionProviderModalProps {
  open: boolean;
  onClose: () => void;
  provider: TranscriptionProvider | null;
  onTest: (id: string, audioUrl?: string) => Promise<TestTranscriptionResult>;
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

export function TestTranscriptionProviderModal({
  open,
  onClose,
  provider,
  onTest,
}: TestTranscriptionProviderModalProps) {
  const [audioUrl, setAudioUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestTranscriptionResult | null>(null);

  const handleTest = async () => {
    if (!provider) return;

    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(provider.id, audioUrl || undefined);
      setTestResult(result);
    } catch (error) {
      // Error handled by parent
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setAudioUrl('');
    setTestResult(null);
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test Transcription Provider</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">Testing Provider</p>
            <p className="text-lg font-semibold">{getProviderDisplayName(provider.provider_name)}</p>
            <p className="text-xs text-muted-foreground">Model: {provider.model || 'Default'}</p>
          </div>

          <div>
            <Label htmlFor="audioUrl">Audio URL (Optional)</Label>
            <Input
              id="audioUrl"
              type="url"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://example.com/test-audio.mp3"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to use default test file
            </p>
          </div>

          {testResult && (
            <Alert variant={testResult.test_status === 'success' ? 'default' : 'destructive'}>
              <AlertTitle>
                {testResult.test_status === 'success' ? '✓ Test Successful' : '✗ Test Failed'}
              </AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  {testResult.test_status === 'success' ? (
                    <>
                      <p className="text-sm">
                        API key is valid and transcription service is working correctly.
                      </p>
                      {testResult.transcription_preview && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Transcription Preview:</p>
                          <p className="text-sm mt-1 bg-muted p-2 rounded">
                            {testResult.transcription_preview}
                          </p>
                        </div>
                      )}
                      <div className="flex gap-4 text-xs mt-2 text-muted-foreground">
                        <span>API Key: ✓ Valid</span>
                        {testResult.quota_remaining !== null && (
                          <span>Quota Remaining: {testResult.quota_remaining.toLocaleString()}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">Transcription test failed.</p>
                      {testResult.error_message && (
                        <p className="text-sm mt-2 text-destructive">{testResult.error_message}</p>
                      )}
                      <div className="flex gap-4 text-xs mt-2 text-muted-foreground">
                        <span>API Key: {testResult.api_key_valid ? '✓ Valid' : '✗ Invalid'}</span>
                      </div>
                    </>
                  )}
                  <p className="text-xs mt-2">
                    Response time: {testResult.response_time_ms}ms
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={handleClose} variant="secondary" disabled={testing}>
              Close
            </Button>
            <Button onClick={handleTest} disabled={testing}>
              {testing ? 'Testing...' : 'Run Test'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
