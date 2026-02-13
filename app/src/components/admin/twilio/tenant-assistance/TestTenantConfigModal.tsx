'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { TestConfigResult } from '@/lib/types/twilio-admin';

interface TestTenantConfigModalProps {
  open: boolean;
  onClose: () => void;
  tenantName: string;
  configType: 'sms' | 'whatsapp';
  onTest: () => Promise<TestConfigResult>;
}

export function TestTenantConfigModal({
  open,
  onClose,
  tenantName,
  configType,
  onTest,
}: TestTenantConfigModalProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConfigResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch (error) {
      // Error handled by parent
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTestResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test {configType.toUpperCase()} Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">Testing Configuration</p>
            <p className="text-lg font-semibold">{tenantName}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {configType} Configuration Test
            </p>
          </div>

          {!testResult && !testing && (
            <Alert>
              <AlertTitle>Test Configuration</AlertTitle>
              <AlertDescription>
                This will send a test {configType} message using the tenant's configuration to
                verify it works correctly.
              </AlertDescription>
            </Alert>
          )}

          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              <AlertTitle>
                {testResult.success ? '✓ Test Successful' : '✗ Test Failed'}
              </AlertTitle>
              <AlertDescription>
                {testResult.message}
                {testResult.success && testResult.test_message_sid && (
                  <p className="text-xs mt-2 font-mono">
                    Message SID: {testResult.test_message_sid}
                  </p>
                )}
                {testResult.error && (
                  <p className="text-sm mt-2 text-destructive">{testResult.error}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={handleClose} variant="secondary" disabled={testing}>
              Close
            </Button>
            <Button onClick={handleTest} disabled={testing}>
              {testing ? 'Testing...' : 'Send Test Message'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
