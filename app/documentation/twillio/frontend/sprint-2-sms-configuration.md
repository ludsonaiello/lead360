# Sprint 2: SMS Configuration Management

**Developer**: Developer 2
**Dependencies**: Sprint 1 (API client, types, directory structure)
**Duration**: 1 sprint

---

## 🎯 Sprint Goal

Implement full CRUD (Create, Read, Update, Delete) functionality for SMS provider configuration, including:
- View active SMS configuration
- Create new SMS configuration with Twilio credentials
- Edit existing SMS configuration
- Deactivate SMS configuration
- Test SMS configuration (send test message)
- RBAC enforcement (Owner/Admin only for CRUD)

---

## 📋 Prerequisites

### Test Credentials
- **API Base URL**: `http://localhost:8000/api/v1`
- **Test Email**: `contact@honeydo4you.com`
- **Test Password**: `978@F32c`

### Required Files from Sprint 1
- `/app/src/lib/api/twilio-tenant.ts` - API client functions
- `/app/src/lib/types/twilio-tenant.ts` - Type definitions

### Required Reading
1. **Backend API Documentation**: Read SMS Configuration section in `/api/documentation/communication_twillio_REST_API.md`
   - Lines 110-457 (SMS Configuration Endpoints)
   - Understand all 5 endpoints, request/response formats, error codes

2. **Existing Patterns**: Study these files:
   - `/app/src/app/(dashboard)/communications/settings/page.tsx` - Email provider configuration (similar pattern)
   - `/app/src/components/ui/Modal.tsx` - Modal component usage
   - `/app/src/components/ui/Input.tsx` - Form input patterns
   - `/app/src/components/ui/PhoneInput.tsx` - Masked phone input

3. **Component Library**: Available components to use:
   - `Button`, `Modal`, `Input`, `PhoneInput`, `ToggleSwitch`, `Badge`, `Card`, `LoadingSpinner`, `ConfirmModal`

---

## 🏗️ Tasks

### Task 1: Test SMS API Endpoints (CRITICAL FIRST STEP)

Before writing any UI code, **VERIFY the API works exactly as documented**.

#### Testing Script:

```bash
# 1. Login to get token
TOKEN=$(curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# 2. Get SMS config (expect 404 if none exists)
curl -X GET "http://localhost:8000/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# Expected Response (if config exists):
# {
#   "id": "uuid",
#   "tenant_id": "uuid",
#   "provider_id": "uuid",
#   "from_phone": "+19781234567",
#   "is_active": true,
#   "is_verified": true,
#   "created_at": "2026-02-05T10:00:00.000Z",
#   "updated_at": "2026-02-05T10:00:00.000Z"
# }

# Expected Response (if no config):
# {
#   "statusCode": 404,
#   "message": "No active SMS configuration found for this tenant",
#   "error": "Not Found"
# }

# ⚠️ CRITICAL: If response structure differs from above, STOP and report to human

# 3. Get provider_id for Twilio SMS (you'll need this for create)
curl -X GET "http://localhost:8000/api/v1/communication/providers" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[] | select(.name == "Twilio SMS")'

# Note the provider_id for twilio_sms

# 4. Create SMS config (ONLY if you have real Twilio credentials)
# DO NOT create with fake credentials - validation will fail
# If you don't have real credentials, SKIP this test and document it

curl -X POST "http://localhost:8000/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "PROVIDER_ID_FROM_STEP_3",
    "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "auth_token": "your_real_auth_token_here",
    "from_phone": "+19781234567"
  }' \
  | jq '.'

# Expected Response: Same as GET (201 Created status)

# 5. Test SMS config (sends actual test SMS)
# Replace CONFIG_ID with ID from step 4
curl -X POST "http://localhost:8000/api/v1/communication/twilio/sms-config/CONFIG_ID/test" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# Expected Response:
# {
#   "success": true,
#   "message": "Test SMS sent successfully",
#   "twilio_message_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
#   "from": "+19781234567",
#   "to": "+19781234567"
# }

# 6. Update SMS config
curl -X PATCH "http://localhost:8000/api/v1/communication/twilio/sms-config/CONFIG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from_phone": "+19781234568"}' \
  | jq '.'

# 7. Deactivate SMS config
curl -X DELETE "http://localhost:8000/api/v1/communication/twilio/sms-config/CONFIG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# Expected Response: Same as GET but with "is_active": false
```

**⚠️ MANDATORY**: Document test results. If ANY response doesn't match documentation:
1. **STOP development immediately**
2. Document the discrepancy (expected vs actual)
3. Report to human
4. Wait for backend fix

---

### Task 2: Create SMS Configuration Page

**File**: `/app/src/app/(dashboard)/communications/twilio/sms/page.tsx`

This is the main SMS configuration page. It should display the current configuration (if any) and allow users to create/edit/test/deactivate.

#### Page Design Requirements:

**Layout**:
- Header with title and description
- Status card showing current configuration (if exists)
- "Configure SMS" button (if no config) or "Edit Configuration" button (if config exists)
- "Test Configuration" button (if config exists and verified)
- "Deactivate" button (if config exists)

**RBAC**:
- **View**: All roles (Owner, Admin, Manager, Sales, Employee)
- **Edit/Create/Delete**: Only Owner and Admin
- Hide edit/create/delete buttons for other roles

**States**:
1. **No Configuration**: Show empty state with "Configure SMS" button
2. **Configuration Exists**: Show configuration details card with actions
3. **Loading**: Show skeleton loader
4. **Error**: Show error message with retry button

#### Implementation:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Phone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { CreateSMSConfigModal } from '@/components/twilio/modals/CreateSMSConfigModal';
import { EditSMSConfigModal } from '@/components/twilio/modals/EditSMSConfigModal';

import {
  getActiveSMSConfig,
  deactivateSMSConfig,
  testSMSConfig,
} from '@/lib/api/twilio-tenant';
import type { SMSConfig } from '@/lib/types/twilio-tenant';

export default function SMSConfigurationPage() {
  const router = useRouter();

  // State
  const [config, setConfig] = useState<SMSConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // User role (from auth context or props)
  // TODO: Get from actual auth context
  const userRole = 'Owner'; // For now, hardcode (replace with actual auth)
  const canEdit = ['Owner', 'Admin'].includes(userRole);

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await getActiveSMSConfig();
      setConfig(data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No config exists - this is normal
        setConfig(null);
      } else {
        console.error('Error fetching SMS config:', error);
        toast.error('Failed to load SMS configuration');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!config) return;

    try {
      setTesting(true);
      const result = await testSMSConfig(config.id);
      toast.success(result.message);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to send test SMS';
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!config) return;

    try {
      setDeactivating(true);
      await deactivateSMSConfig(config.id);
      toast.success('SMS configuration deactivated');
      setShowDeactivateModal(false);
      fetchConfig(); // Refresh
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to deactivate configuration';
      toast.error(message);
    } finally {
      setDeactivating(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    toast.success('SMS configuration created successfully');
    fetchConfig();
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    toast.success('SMS configuration updated successfully');
    fetchConfig();
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            SMS Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure Twilio SMS provider for sending text messages
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // No configuration exists
  if (!config) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            SMS Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure Twilio SMS provider for sending text messages
          </p>
        </div>

        <Card className="text-center py-12">
          <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No SMS Configuration
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Get started by configuring your Twilio SMS provider
          </p>
          {canEdit && (
            <Button onClick={() => setShowCreateModal(true)}>
              Configure SMS Provider
            </Button>
          )}
          {!canEdit && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Contact your administrator to configure SMS
            </p>
          )}
        </Card>

        {/* Create Modal */}
        {showCreateModal && (
          <CreateSMSConfigModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateSuccess}
          />
        )}
      </div>
    );
  }

  // Configuration exists
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            SMS Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your Twilio SMS provider settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button
                variant="secondary"
                onClick={() => setShowEditModal(true)}
              >
                Edit Configuration
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowDeactivateModal(true)}
              >
                Deactivate
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Twilio SMS Provider
              </h3>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Phone Number:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {config.from_phone}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <Badge variant={config.is_active ? 'success' : 'secondary'}>
                    {config.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Verification:</span>
                  {config.is_verified ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                      <AlertCircle className="h-4 w-4" />
                      <span>Not Verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div>
            {canEdit && config.is_active && (
              <Button
                onClick={handleTest}
                loading={testing}
                variant="secondary"
              >
                Send Test SMS
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Created: {new Date(config.created_at).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last Updated: {new Date(config.updated_at).toLocaleString()}
          </p>
        </div>
      </Card>

      {/* Security Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Security Notice
            </h4>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Your Twilio credentials (Account SID and Auth Token) are encrypted and never displayed for security.
              To update credentials, use the Edit Configuration button.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditSMSConfigModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
          config={config}
        />
      )}

      {/* Deactivate Confirmation */}
      {showDeactivateModal && (
        <ConfirmModal
          isOpen={showDeactivateModal}
          onClose={() => setShowDeactivateModal(false)}
          onConfirm={handleDeactivate}
          title="Deactivate SMS Configuration?"
          message="Are you sure you want to deactivate this SMS configuration? You will no longer be able to send SMS messages until you reactivate or create a new configuration."
          confirmText="Deactivate"
          confirmVariant="danger"
          loading={deactivating}
        />
      )}
    </div>
  );
}
```

---

### Task 3: Create SMS Configuration Modal

**File**: `/app/src/components/twilio/modals/CreateSMSConfigModal.tsx`

This modal allows Owner/Admin to create a new SMS configuration with Twilio credentials.

#### Form Fields:
1. **Provider ID** (hidden or auto-filled)
2. **Account SID** - Text input with validation (pattern: `^AC[a-z0-9]{32}$`)
3. **Auth Token** - Password input with validation (min 32 chars)
4. **From Phone** - PhoneInput component (E.164 format)
5. **Webhook Secret** - Optional text input

#### Validation Rules:
- Account SID must start with "AC" and be exactly 34 characters
- Auth Token must be at least 32 characters
- From Phone must be in E.164 format (starting with +)
- All required fields must be filled

#### Implementation:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';

import { createSMSConfig } from '@/lib/api/twilio-tenant';
import type { CreateSMSConfigRequest } from '@/lib/types/twilio-tenant';

interface CreateSMSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateSMSConfigModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSMSConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateSMSConfigRequest>({
    provider_id: '', // Will be fetched
    account_sid: '',
    auth_token: '',
    from_phone: '',
    webhook_secret: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch provider_id for Twilio SMS
  useEffect(() => {
    // TODO: Fetch providers and find Twilio SMS provider
    // For now, you'll need to manually get this from the API
    // curl http://localhost:8000/api/v1/communication/providers
    // Find the provider with name "Twilio SMS" and use its ID

    // TEMPORARY: Set a placeholder (replace with actual fetch)
    setFormData(prev => ({ ...prev, provider_id: 'REPLACE_WITH_ACTUAL_PROVIDER_ID' }));
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Account SID validation
    if (!formData.account_sid) {
      newErrors.account_sid = 'Account SID is required';
    } else if (!/^AC[a-z0-9]{32}$/.test(formData.account_sid)) {
      newErrors.account_sid = 'Account SID must start with AC and be 34 characters (AC + 32 alphanumeric)';
    }

    // Auth Token validation
    if (!formData.auth_token) {
      newErrors.auth_token = 'Auth Token is required';
    } else if (formData.auth_token.length < 32) {
      newErrors.auth_token = 'Auth Token must be at least 32 characters';
    }

    // From Phone validation
    if (!formData.from_phone) {
      newErrors.from_phone = 'Phone number is required';
    } else if (!/^\+[1-9]\d{1,14}$/.test(formData.from_phone)) {
      newErrors.from_phone = 'Phone must be in E.164 format (e.g., +19781234567)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      setLoading(true);

      // Remove webhook_secret if empty
      const payload = { ...formData };
      if (!payload.webhook_secret) {
        delete payload.webhook_secret;
      }

      await createSMSConfig(payload);
      toast.success('SMS configuration created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating SMS config:', error);
      const message = error.response?.data?.message || 'Failed to create SMS configuration';
      toast.error(message);

      // Handle specific errors
      if (error.response?.status === 409) {
        setErrors({ account_sid: 'Active SMS configuration already exists. Deactivate existing config first.' });
      } else if (error.response?.status === 400) {
        // Invalid credentials
        setErrors({ account_sid: 'Invalid Twilio credentials. Please check Account SID and Auth Token.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure SMS Provider"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Account SID */}
            <Input
              label="Twilio Account SID"
              name="account_sid"
              value={formData.account_sid}
              onChange={(e) => setFormData({ ...formData, account_sid: e.target.value })}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              error={errors.account_sid}
              required
              helpText="Your Twilio Account SID (starts with AC, 34 characters)"
            />

            {/* Auth Token */}
            <Input
              label="Twilio Auth Token"
              name="auth_token"
              type="password"
              value={formData.auth_token}
              onChange={(e) => setFormData({ ...formData, auth_token: e.target.value })}
              placeholder="Enter your Twilio Auth Token"
              error={errors.auth_token}
              required
              helpText="Your Twilio Auth Token (at least 32 characters, will be encrypted)"
            />

            {/* From Phone */}
            <PhoneInput
              label="Twilio Phone Number"
              value={formData.from_phone}
              onChange={(value) => setFormData({ ...formData, from_phone: value })}
              error={errors.from_phone}
              required
              helpText="Your Twilio phone number in E.164 format (e.g., +19781234567)"
            />

            {/* Webhook Secret (Optional) */}
            <Input
              label="Webhook Secret (Optional)"
              name="webhook_secret"
              value={formData.webhook_secret}
              onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
              placeholder="Optional webhook secret for signature verification"
              error={errors.webhook_secret}
              helpText="Optional secret for Twilio webhook signature verification"
            />

            {/* Security Notice */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Security:</strong> Your credentials will be encrypted before storage and validated against Twilio's API before saving.
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
          >
            Create Configuration
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
```

---

### Task 4: Create Edit SMS Configuration Modal

**File**: `/app/src/components/twilio/modals/EditSMSConfigModal.tsx`

Similar to create modal, but allows editing existing configuration.

**Key Differences**:
- All fields optional (partial update)
- Pre-fill with current values
- Credentials fields show placeholder text (not actual values for security)
- Use PATCH endpoint instead of POST

```typescript
'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';

import { updateSMSConfig } from '@/lib/api/twilio-tenant';
import type { SMSConfig, UpdateSMSConfigRequest } from '@/lib/types/twilio-tenant';

interface EditSMSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  config: SMSConfig;
}

export function EditSMSConfigModal({
  isOpen,
  onClose,
  onSuccess,
  config,
}: EditSMSConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateSMSConfigRequest>({
    from_phone: config.from_phone,
    is_active: config.is_active,
    account_sid: '', // Don't pre-fill credentials for security
    auth_token: '',
    webhook_secret: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Account SID validation (if provided)
    if (formData.account_sid && !/^AC[a-z0-9]{32}$/.test(formData.account_sid)) {
      newErrors.account_sid = 'Account SID must start with AC and be 34 characters';
    }

    // Auth Token validation (if provided)
    if (formData.auth_token && formData.auth_token.length < 32) {
      newErrors.auth_token = 'Auth Token must be at least 32 characters';
    }

    // From Phone validation (if provided)
    if (formData.from_phone && !/^\+[1-9]\d{1,14}$/.test(formData.from_phone)) {
      newErrors.from_phone = 'Phone must be in E.164 format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      setLoading(true);

      // Build payload (only include changed fields)
      const payload: UpdateSMSConfigRequest = {};
      if (formData.account_sid) payload.account_sid = formData.account_sid;
      if (formData.auth_token) payload.auth_token = formData.auth_token;
      if (formData.from_phone !== config.from_phone) payload.from_phone = formData.from_phone;
      if (formData.webhook_secret) payload.webhook_secret = formData.webhook_secret;
      if (formData.is_active !== config.is_active) payload.is_active = formData.is_active;

      await updateSMSConfig(config.id, payload);
      toast.success('SMS configuration updated successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating SMS config:', error);
      const message = error.response?.data?.message || 'Failed to update SMS configuration';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit SMS Configuration"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* From Phone */}
            <PhoneInput
              label="Twilio Phone Number"
              value={formData.from_phone}
              onChange={(value) => setFormData({ ...formData, from_phone: value })}
              error={errors.from_phone}
              helpText="Update your Twilio phone number"
            />

            {/* Account SID (optional update) */}
            <Input
              label="Update Account SID (Optional)"
              name="account_sid"
              value={formData.account_sid || ''}
              onChange={(e) => setFormData({ ...formData, account_sid: e.target.value })}
              placeholder="Leave empty to keep current value"
              error={errors.account_sid}
              helpText="Only fill if you want to change your Account SID"
            />

            {/* Auth Token (optional update) */}
            <Input
              label="Update Auth Token (Optional)"
              name="auth_token"
              type="password"
              value={formData.auth_token || ''}
              onChange={(e) => setFormData({ ...formData, auth_token: e.target.value })}
              placeholder="Leave empty to keep current value"
              error={errors.auth_token}
              helpText="Only fill if you want to change your Auth Token"
            />

            {/* Webhook Secret (optional update) */}
            <Input
              label="Update Webhook Secret (Optional)"
              name="webhook_secret"
              value={formData.webhook_secret || ''}
              onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
              placeholder="Leave empty to keep current value"
              helpText="Update webhook secret if needed"
            />

            {/* Active Toggle */}
            <ToggleSwitch
              label="Active"
              checked={formData.is_active ?? true}
              onChange={(checked) => setFormData({ ...formData, is_active: checked })}
              helpText="Enable or disable this configuration"
            />
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
          >
            Save Changes
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
```

---

## ✅ Sprint 2 Completion Checklist

### API Testing
- [ ] All 5 SMS endpoints tested with curl
- [ ] Request/response structures verified against documentation
- [ ] Error responses tested (404, 400, 409, 403)
- [ ] RBAC tested (Owner can edit, Employee cannot)
- [ ] Any discrepancies documented and reported

### Page Implementation
- [ ] SMS configuration page displays correctly
- [ ] Loading states work (skeleton loader)
- [ ] Empty state shows when no config
- [ ] Configuration card shows all details
- [ ] Status badges display correctly (Active/Inactive, Verified/Not Verified)

### Create Modal
- [ ] Modal opens and closes properly
- [ ] All form fields render correctly
- [ ] Validation works (Account SID pattern, Auth Token length, Phone E.164)
- [ ] Submit creates configuration successfully
- [ ] Error handling works (toast notifications)
- [ ] Success callback refreshes page

### Edit Modal
- [ ] Modal pre-fills with current phone number
- [ ] Credentials fields show placeholders (not actual values)
- [ ] Partial update works (only changed fields sent)
- [ ] Active toggle works
- [ ] Success callback refreshes page

### Test Feature
- [ ] "Send Test SMS" button only shows for active configs
- [ ] Test sends actual SMS (if real credentials provided)
- [ ] Success toast shows Twilio Message SID
- [ ] Error handling works

### Deactivate Feature
- [ ] Confirmation modal shows before deactivation
- [ ] Deactivation sets is_active to false
- [ ] Page refreshes after deactivation
- [ ] Success toast shows

### RBAC
- [ ] Edit/Create/Delete buttons hidden for non-Owner/Admin roles
- [ ] API enforces permissions (403 error for unauthorized users)
- [ ] View-only users can see config but not modify

### Mobile Responsiveness
- [ ] Page works on 375px viewport
- [ ] Modals are responsive
- [ ] Buttons stack properly on mobile

### Dark Mode
- [ ] All components support dark mode
- [ ] Text is readable in both modes
- [ ] No visual glitches

---

## 📤 Deliverables

1. **SMS Configuration Page**: `/app/src/app/(dashboard)/communications/twilio/sms/page.tsx`
2. **Create Modal**: `/app/src/components/twilio/modals/CreateSMSConfigModal.tsx`
3. **Edit Modal**: `/app/src/components/twilio/modals/EditSMSConfigModal.tsx`
4. **API Testing Report**: Document showing all endpoints tested and verified

---

## 🚦 Next Sprint

**Sprint 3: WhatsApp Configuration Management**
- Same pattern as SMS
- WhatsApp-specific considerations (whatsapp: prefix, Business Account requirements)
- Can reuse most of Sprint 2 patterns

---

## ⚠️ Critical Reminders

1. **Test API FIRST**: Use curl to verify all endpoints before UI coding
2. **Stop if discrepancies found**: Report to human immediately
3. **RBAC enforcement**: Hide buttons, backend will enforce
4. **Credentials security**: Never display Account SID or Auth Token
5. **E.164 phone format**: Always validate (starting with +)
6. **Only one active config**: Backend enforces, handle 409 error

---

**Sprint 2 Status**: Ready to Start (after Sprint 1 complete)
**Estimated Duration**: 1 week
**Blockers**: Sprint 1 must be complete (API client, types)
