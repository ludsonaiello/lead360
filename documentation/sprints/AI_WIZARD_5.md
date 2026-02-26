# Sprint AI_WIZARD_5: Create Setup Wizard & Completion Tracking

> **FOR MASTERCLASS AI AGENT CODERS**
>
> You are an elite full-stack frontend developer. You build complex, stateful components with multiple steps, data fetching, and user interactions. You write maintainable code with clear state management. You test exhaustively. This is your masterpiece.

---

## Sprint Metadata

**Module**: Voice AI - Context Enhancement
**Sprint**: AI_WIZARD_5
**Depends on**: AI_WIZARD_1, 2, 3, 4 (all previous sprints complete)
**Estimated time**: 5-6 hours
**Complexity**: HIGH
**Risk**: MEDIUM (complex component with state management)

---

## Objective

Create a 7-step setup wizard that guides tenants through Voice AI configuration. The wizard checks configuration status, allows inline editing of business description, navigates to external settings pages, and tracks completion via localStorage.

**What Success Looks Like**:
- Modal-based wizard with 7 steps
- Progress bar shows completion percentage
- Each step checks configuration status (✓ or warning)
- Business description editable inline
- External links navigate to settings pages
- Completion tracked in localStorage
- Setup banner shows/dismisses correctly
- Mobile responsive and dark mode work

---

## Test Credentials

**Tenant User (Owner/Admin)**:
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`

---

## STEP 0: Test All Required APIs

**CRITICAL**: This wizard depends on multiple APIs. Test them all first.

### Get JWT Token

```bash
curl -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@honeydo4you.com",
    "password": "978@F32c"
  }' | jq -r '.access_token'
```

Save token:
```bash
export TOKEN="<paste_token_here>"
```

### Test GET Tenant Profile

```bash
curl https://api.lead360.app/api/v1/tenants/current \
  -H "Authorization: Bearer $TOKEN" \
  | jq '{company_name, business_description, services_offered, service_areas}'
```

**Check**: Returns tenant with fields listed above.

### Test GET Business Hours

```bash
curl https://api.lead360.app/api/v1/tenants/current/business-hours \
  -H "Authorization: Bearer $TOKEN" \
  | jq 'length'
```

**Check**: Returns array length (0 if not configured, >0 if configured).

### Test GET Transfer Numbers

```bash
curl https://api.lead360.app/api/v1/voice-ai/transfer-numbers \
  -H "Authorization: Bearer $TOKEN" \
  | jq 'length'
```

**Check**: Returns array length (0 if not configured, >0 if configured).

### Test PATCH Business Description

```bash
curl -X PATCH https://api.lead360.app/api/v1/tenants/current \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"business_description": "Test wizard save"}' \
  | jq '.business_description'
```

**Check**: Returns "Test wizard save".

✅ **All 4 API tests must pass before proceeding. If any fail, call a human.**

---

## Documentation to Read First

**MANDATORY READING** (1 hour):

1. **Modal Component**:
   - `/var/www/lead360.app/app/src/components/ui/Modal.tsx`
   - Understand: How to open/close, sizes, structure

2. **Wizard Component** (if exists):
   - `/var/www/lead360.app/app/src/components/ui/Wizard.tsx`
   - Understand: Step navigation, progress bar
   - If doesn't exist, you'll build step management manually

3. **Textarea Component**:
   - `/var/www/lead360.app/app/src/components/ui/Textarea.tsx`
   - For inline business description editing

4. **Voice AI Settings Page**:
   - `/var/www/lead360.app/app/src/app/(dashboard)/voice-ai/settings/page.tsx`
   - Where wizard will be triggered

5. **React Hook Patterns**:
   - `useState` for state management
   - `useEffect` for data fetching
   - `useRouter` for navigation (Next.js)

6. **localStorage API**:
   - Review: `localStorage.setItem()`, `getItem()`, browser compatibility

**Time Investment**: 60 minutes

---

## Implementation Steps

### Step 1: Create VoiceAiSetupWizard Component

**File**: `/var/www/lead360.app/app/src/components/voice-ai/tenant/settings/VoiceAiSetupWizard.tsx` (NEW)

This is a large file (~600 lines). Build it section by section.

#### Part 1: Imports and Interfaces

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Briefcase,
  MapPin,
  FileText,
  Phone,
  PartyPopper,
  Loader2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import * as tenantApi from '@/lib/api/tenant';
import * as voiceAiApi from '@/lib/api/voice-ai';
import { toast } from 'react-hot-toast';

interface VoiceAiSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface SetupStatus {
  businessHours: boolean;
  services: boolean;
  serviceAreas: boolean;
  businessDescription: boolean;
  transferNumbers: boolean;
}

interface WizardStep {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
}
```

#### Part 2: Component Definition and State

```typescript
export function VoiceAiSetupWizard({
  isOpen,
  onClose,
  onComplete,
}: VoiceAiSetupWizardProps) {
  const router = useRouter();

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatus>({
    businessHours: false,
    services: false,
    serviceAreas: false,
    businessDescription: false,
    transferNumbers: false,
  });

  // Business description inline editing
  const [businessDescription, setBusinessDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Wizard steps
  const steps: WizardStep[] = [
    { id: 'welcome', label: 'Welcome', icon: PartyPopper },
    { id: 'hours', label: 'Business Hours', icon: Clock },
    { id: 'services', label: 'Services', icon: Briefcase },
    { id: 'areas', label: 'Service Areas', icon: MapPin },
    { id: 'description', label: 'About Your Business', icon: FileText },
    { id: 'transfer', label: 'Transfer Numbers', icon: Phone },
    { id: 'complete', label: 'Complete', icon: CheckCircle },
  ];
```

#### Part 3: Data Fetching Effect

```typescript
  // Load setup status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkSetupStatus();
    }
  }, [isOpen]);

  const checkSetupStatus = async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [tenant, businessHours, transferNumbers] = await Promise.all([
        tenantApi.getCurrentTenant(),
        tenantApi.getBusinessHours(),
        voiceAiApi.getTransferNumbers(),
      ]);

      // Check each requirement
      setStatus({
        businessHours: businessHours.length > 0,
        services: Array.isArray(tenant.services_offered) && tenant.services_offered.length > 0,
        serviceAreas: Array.isArray(tenant.service_areas) && tenant.service_areas.length > 0,
        businessDescription: !!tenant.business_description && tenant.business_description.trim().length > 0,
        transferNumbers: transferNumbers.length > 0,
      });

      // Load business description for inline editing
      setBusinessDescription(tenant.business_description || '');
    } catch (error: any) {
      console.error('Failed to load setup status:', error);
      toast.error('Failed to load setup information');
    } finally {
      setLoading(false);
    }
  };
```

#### Part 4: Save Business Description Function

```typescript
  const saveBusinessDescription = async () => {
    if (!businessDescription.trim()) {
      toast.error('Please enter a business description');
      return;
    }

    try {
      setIsSaving(true);
      await tenantApi.updateTenantProfile({
        business_description: businessDescription,
      });

      // Update status
      setStatus({ ...status, businessDescription: true });
      toast.success('Business description saved');
    } catch (error: any) {
      console.error('Failed to save business description:', error);
      toast.error(error.response?.data?.message || 'Failed to save business description');
    } finally {
      setIsSaving(false);
    }
  };
```

#### Part 5: Setup Completion Check

```typescript
  const isSetupComplete = (): boolean => {
    return (
      status.businessHours &&
      status.services &&
      status.serviceAreas &&
      status.businessDescription
      // transferNumbers is optional
    );
  };

  const handleFinish = () => {
    if (isSetupComplete()) {
      // Mark as complete in localStorage
      localStorage.setItem('voice_ai_setup_completed', 'true');
      onComplete();
      onClose();
      toast.success('Voice AI setup complete!');
    } else {
      toast.error('Please complete all required steps before finishing');
    }
  };
```

#### Part 6: Navigation Functions

```typescript
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow clicking any step (not just forward)
    setCurrentStep(stepIndex);
  };
```

#### Part 7: Render Step Content (Welcome & Business Hours)

```typescript
  const renderStepContent = () => {
    if (loading) {
      return (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    const StepIcon = steps[currentStep].icon;

    switch (steps[currentStep].id) {
      case 'welcome':
        return (
          <div className="py-8 text-center space-y-6">
            <PartyPopper className="h-16 w-16 text-blue-600 dark:text-blue-400 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome to Voice AI Setup
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Let's configure your Voice AI agent in just a few steps.
              This ensures your agent has all the information needed to handle calls professionally.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg inline-block">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Takes about 5 minutes</span>
              </div>
            </div>
          </div>
        );

      case 'hours':
        return (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Business Hours
              </h3>
            </div>

            {status.businessHours ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                      Business hours configured ✓
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your operating hours are set. The AI agent can inform callers when you're available.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                      Business hours not set
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      The AI agent needs to know when you're open to provide accurate information to callers.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    router.push('/settings/business#hours');
                    onClose();
                  }}
                >
                  Configure Business Hours →
                </Button>
              </div>
            )}
          </div>
        );

      // Services, Service Areas, Transfer Numbers steps follow same pattern...
```

#### Part 8: Render Step Content (Business Description)

```typescript
      case 'description':
        return (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                About Your Business
              </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Help the AI agent introduce your company by providing a brief description.
              Include your history, specialties, service area, and what makes you unique.
            </p>

            <Textarea
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder="E.g., Family-owned plumbing company serving Miami for 20+ years. We specialize in residential and commercial plumbing repairs, installations, and 24/7 emergency services."
              rows={6}
              maxLength={5000}
              showCharacterCount={true}
              resize="vertical"
              label="Business Description"
            />

            <Button
              variant="primary"
              onClick={saveBusinessDescription}
              disabled={isSaving || !businessDescription.trim()}
              loading={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Description'}
            </Button>

            {status.businessDescription && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>Description saved successfully</span>
              </div>
            )}
          </div>
        );
```

#### Part 9: Render Step Content (Services, Areas, Transfer, Complete)

```typescript
      case 'services':
        return (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Briefcase className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Services Offered
              </h3>
            </div>

            {status.services ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                      Services configured ✓
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your services are set. The AI agent can discuss them with callers.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                      No services configured
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Add your services so the AI agent can discuss them with callers.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    router.push('/settings/business#services');
                    onClose();
                  }}
                >
                  Add Services →
                </Button>
              </div>
            )}
          </div>
        );

      case 'areas':
        return (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Service Areas
              </h3>
            </div>

            {status.serviceAreas ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                      Service areas configured ✓
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your service areas are set. The AI agent can inform callers where you operate.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                      No service areas configured
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Add your service areas so the AI agent knows where you provide services.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    router.push('/settings/business#areas');
                    onClose();
                  }}
                >
                  Add Service Areas →
                </Button>
              </div>
            )}
          </div>
        );

      case 'transfer':
        return (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Phone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Transfer Numbers (Optional)
              </h3>
            </div>

            {status.transferNumbers ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                      Transfer numbers configured ✓
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      The AI agent can transfer calls when needed.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      No transfer numbers (Optional)
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Add transfer numbers if you want the AI agent to transfer calls to your team.
                      This step is optional.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    router.push('/voice-ai/transfer-numbers');
                    onClose();
                  }}
                >
                  Add Transfer Numbers →
                </Button>
              </div>
            )}
          </div>
        );

      case 'complete':
        return (
          <div className="py-8 text-center space-y-6">
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isSetupComplete() ? 'Setup Complete!' : 'Almost There!'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              {isSetupComplete()
                ? 'Your Voice AI agent is ready to handle calls with complete business context.'
                : 'Complete the remaining items to finish setup.'}
            </p>

            {/* Setup checklist */}
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg text-left max-w-md mx-auto">
              <h3 className="font-semibold mb-4 text-gray-900 dark:text-gray-100">
                Setup Status:
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Business Hours', status: status.businessHours, required: true },
                  { label: 'Services', status: status.services, required: true },
                  { label: 'Service Areas', status: status.serviceAreas, required: true },
                  { label: 'Business Description', status: status.businessDescription, required: true },
                  { label: 'Transfer Numbers', status: status.transferNumbers, required: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    {item.status ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertCircle className={`h-5 w-5 ${item.required ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}`} />
                    )}
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item.label}
                      {!item.required && ' (Optional)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };
```

#### Part 10: Main Render (Modal with Progress Bar)

```typescript
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Voice AI Setup - ${steps[currentStep].label}`}
      size="lg"
    >
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step indicator (clickable steps) */}
      <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <button
              key={step.id}
              onClick={() => handleStepClick(index)}
              className={`flex flex-col items-center gap-1 min-w-[60px] ${
                isActive ? 'opacity-100' : 'opacity-50 hover:opacity-75'
              } transition-opacity`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <StepIcon className="h-5 w-5" />
              </div>
              <span className="text-xs text-center text-gray-600 dark:text-gray-400">
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[350px]">
        {renderStepContent()}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="ghost"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          Previous
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={currentStep === steps.length - 1 && !isSetupComplete()}
          >
            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

**File Complete**: ~650 lines total.

---

### Step 2: Integrate Wizard into Voice AI Settings Page

**File**: `/var/www/lead360.app/app/src/app/(dashboard)/voice-ai/settings/page.tsx`

#### Add Import

```typescript
import { VoiceAiSetupWizard } from '@/components/voice-ai/tenant/settings/VoiceAiSetupWizard';
import { AlertCircle } from 'lucide-react';
```

#### Add State Variables

Inside the page component, add:

```typescript
const [showWizard, setShowWizard] = useState(false);
const [showSetupBanner, setShowSetupBanner] = useState(false);
```

#### Add useEffect to Check Setup Status

```typescript
useEffect(() => {
  const setupComplete = localStorage.getItem('voice_ai_setup_completed');
  const bannerDismissed = localStorage.getItem('voice_ai_setup_banner_dismissed');
  setShowSetupBanner(!setupComplete && !bannerDismissed && canEdit);
}, [canEdit]);
```

#### Add Setup Banner (Before Context Section)

```tsx
{/* Setup Banner */}
{showSetupBanner && (
  <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
          Complete Voice AI Setup
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
          Configure essential information to help the Voice AI agent provide the best experience for your callers.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowWizard(true)}
          >
            Start Setup Wizard
          </Button>
          <button
            onClick={() => {
              localStorage.setItem('voice_ai_setup_banner_dismissed', 'true');
              setShowSetupBanner(false);
            }}
            className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

#### Add Wizard Component (At End of Component, Before Closing Tag)

```tsx
{/* Wizard Modal */}
{canEdit && (
  <VoiceAiSetupWizard
    isOpen={showWizard}
    onClose={() => setShowWizard(false)}
    onComplete={() => {
      setShowSetupBanner(false);
      // Optionally refresh context components
      window.location.reload(); // Simple refresh (or use state to trigger re-fetch)
    }}
  />
)}
```

---

## Testing Checklist (100+ Items)

### Setup
- [ ] All previous sprints (1-4) complete
- [ ] Start app: `cd /var/www/lead360.app/app && npm run dev`
- [ ] Login as Owner/Admin
- [ ] Navigate to Voice AI → Settings
- [ ] No TypeScript errors
- [ ] No console errors

### Banner Behavior
- [ ] Setup banner appears on first visit (if setup incomplete)
- [ ] Banner has blue background
- [ ] Banner shows correct title and description
- [ ] "Start Setup Wizard" button visible
- [ ] "Dismiss" link visible
- [ ] Click "Dismiss" - banner disappears
- [ ] Refresh page - banner doesn't reappear (localStorage works)
- [ ] Clear localStorage - banner reappears

### Wizard Opening
- [ ] Click "Start Setup Wizard" - modal opens
- [ ] Modal is centered on screen
- [ ] Modal has proper width (lg size)
- [ ] Backdrop (overlay) is visible
- [ ] Click backdrop - modal doesn't close (or does, based on implementation)
- [ ] Press Esc - modal closes

### Progress Bar
- [ ] Progress bar shows "Step 1 of 7"
- [ ] Percentage shows "14%" on step 1
- [ ] Blue bar fills 14% of width
- [ ] Click "Next" - progress updates to "29%"
- [ ] Bar animates smoothly (transition-all)

### Step Indicator (Clickable Steps)
- [ ] 7 step circles appear
- [ ] Current step has blue background
- [ ] Completed steps have green background with checkmark
- [ ] Future steps have gray background
- [ ] Click on different step - navigates to that step
- [ ] Step labels visible below icons

### Step 1: Welcome
- [ ] Party popper icon shows
- [ ] "Welcome to Voice AI Setup" title
- [ ] Description text readable
- [ ] Blue info box shows "Takes about 5 minutes"
- [ ] Checkmark icon in info box

### Step 2: Business Hours
- [ ] Clock icon shows
- [ ] If hours configured - green success box
- [ ] If not configured - yellow warning box
- [ ] "Configure Business Hours →" button visible
- [ ] Click button - navigates to `/settings/business#hours`
- [ ] Modal closes on navigation

### Step 3: Services
- [ ] Briefcase icon shows
- [ ] If configured - green success box
- [ ] If not - yellow warning box
- [ ] "Add Services →" button works

### Step 4: Service Areas
- [ ] MapPin icon shows
- [ ] Status displays correctly
- [ ] Navigation button works

### Step 5: Business Description
- [ ] FileText icon shows
- [ ] Textarea appears with correct placeholder
- [ ] Character counter shows (e.g., "0 / 5000")
- [ ] Can type in textarea
- [ ] Character counter updates in real-time
- [ ] "Save Description" button visible
- [ ] Button disabled if textarea empty
- [ ] Type description - button enables
- [ ] Click "Save Description"
- [ ] Button shows loading state ("Saving...")
- [ ] Success toast appears
- [ ] Green checkmark appears "Description saved successfully"
- [ ] Status updates (checkmark in complete step)

### Step 6: Transfer Numbers
- [ ] Phone icon shows
- [ ] Blue info box (not yellow - it's optional)
- [ ] Note says "Optional"
- [ ] Navigation button works

### Step 7: Complete
- [ ] If setup complete - green checkmark + "Setup Complete!"
- [ ] If incomplete - "Almost There!"
- [ ] Setup checklist shows
- [ ] Each item has correct icon (green checkmark or yellow warning)
- [ ] Required items marked
- [ ] Optional items marked "(Optional)"
- [ ] "Finish" button enabled only if all required items complete

### Navigation
- [ ] "Previous" button disabled on step 1
- [ ] "Previous" button works on other steps
- [ ] "Next" button advances to next step
- [ ] "Next" button changes to "Finish" on step 7
- [ ] "Finish" button disabled if setup incomplete
- [ ] "Finish" button enabled if setup complete
- [ ] Click "Finish" (when complete) - modal closes
- [ ] Success toast appears
- [ ] localStorage set to "true"
- [ ] Banner doesn't reappear

### Loading State
- [ ] Throttle network to "Slow 3G"
- [ ] Open wizard - loading spinner shows
- [ ] Spinner is centered
- [ ] Content appears after loading

### Error Handling
- [ ] Temporarily break tenant API
- [ ] Open wizard - error toast appears
- [ ] Wizard still usable (doesn't crash)

### Mobile Responsive
- [ ] DevTools → iPhone SE (375px)
- [ ] Modal spans appropriate width (not too wide)
- [ ] Progress bar visible
- [ ] Step indicators scrollable horizontally if needed
- [ ] Content readable
- [ ] Buttons accessible
- [ ] Textarea usable
- [ ] Navigation buttons at bottom

### Dark Mode
- [ ] Switch to dark mode
- [ ] Modal background dark
- [ ] All text readable (light colors)
- [ ] Icons visible
- [ ] Progress bar visible
- [ ] Step indicators have dark backgrounds
- [ ] Borders visible but subtle
- [ ] Success/warning boxes have dark backgrounds

### External Navigation
- [ ] Click "Configure Business Hours" - navigates correctly
- [ ] Modal closes on navigation
- [ ] Can reopen wizard after navigating back
- [ ] Data refreshes when wizard reopens

### localStorage Integration
- [ ] Complete wizard
- [ ] Check localStorage: `voice_ai_setup_completed` = "true"
- [ ] Refresh page - banner doesn't show
- [ ] Clear localStorage
- [ ] Refresh page - banner shows again
- [ ] Dismiss banner
- [ ] Check localStorage: `voice_ai_setup_banner_dismissed` = "true"

### Performance
- [ ] No console errors
- [ ] No React warnings
- [ ] No TypeScript errors
- [ ] Wizard opens quickly (<500ms)
- [ ] No memory leaks (check React DevTools)

---

## Success Criteria

**This sprint is complete when**:

1. ✅ VoiceAiSetupWizard component created (~650 lines)
2. ✅ Wizard integrated into Voice AI settings page
3. ✅ Setup banner shows on first visit
4. ✅ Banner dismisses and stays dismissed (localStorage)
5. ✅ Wizard opens in modal
6. ✅ All 7 steps work correctly
7. ✅ Progress bar updates (percentage + visual)
8. ✅ Step indicator is clickable
9. ✅ Business description saves inline
10. ✅ External navigation buttons work
11. ✅ Complete step shows checklist
12. ✅ "Finish" button marks setup complete
13. ✅ Setup completion tracked in localStorage
14. ✅ All tests pass (100+ checklist items)
15. ✅ Mobile responsive (375px, 768px, 1024px)
16. ✅ Dark mode works throughout
17. ✅ No console errors
18. ✅ RBAC respected (Owner/Admin only)

**Definition of Done**:
- Wizard guides users through complete setup
- All configuration status checks work
- Inline editing works
- External navigation works
- Completion tracking works
- Production-ready quality

---

## Troubleshooting Guide

### Issue: Wizard doesn't open

**Solution**:
- Check `showWizard` state is true
- Verify Modal component imported correctly
- Check `isOpen` prop is passed correctly
- Look for TypeScript/console errors

### Issue: Progress bar doesn't update

**Solution**:
- Check `currentStep` state updates
- Verify percentage calculation: `((currentStep + 1) / steps.length) * 100`
- Check CSS transition classes present

### Issue: Business description doesn't save

**Solution**:
- Test API with curl first (Step 0)
- Check Network tab - is PATCH request sent?
- Verify request payload includes `business_description`
- Check for API errors in response

### Issue: localStorage not working

**Solution**:
- Check browser supports localStorage
- Test in console: `localStorage.setItem('test', 'value')`
- Verify key names match: `voice_ai_setup_completed`
- Check no typos in keys

### Issue: External navigation doesn't work

**Solution**:
- Verify `useRouter` from `next/navigation`
- Check paths are correct (`/settings/business#hours`)
- Test navigation outside wizard first
- Check `router.push()` is called

### Issue: Modal too wide on mobile

**Solution**:
- Check Modal size prop: `size="lg"`
- Verify Modal has max-width constraints
- Test at 375px width
- Add custom width classes if needed

---

## Files Created/Modified Summary

1. ✅ `/app/src/components/voice-ai/tenant/settings/VoiceAiSetupWizard.tsx` (NEW - ~650 lines)
2. ✅ `/app/src/app/(dashboard)/voice-ai/settings/page.tsx` (MODIFIED - add wizard integration)

**Total Changes**: 1 new file, 1 modified file, ~700 lines total

---

## Persona Reminder

You are a **masterclass developer**. This is your magnum opus. Before marking complete:

- ✅ Test ALL 100+ checklist items
- ✅ Test on multiple browsers
- ✅ Test all breakpoints (mobile, tablet, desktop)
- ✅ Test dark mode completely
- ✅ Verify all API calls work
- ✅ Check localStorage in different scenarios
- ✅ Test with setup complete and incomplete
- ✅ Verify no existing features broken
- ✅ Code is clean, commented, maintainable
- ✅ No console errors anywhere

**If you find ANY issue, stop immediately and call a human.**

This wizard is your masterpiece. Production-ready, user-friendly, bulletproof. 🎨🚀

---

## Sprint Complete

**Congratulations!** All 5 sprints complete.

The Voice AI Context Enhancement & Setup Wizard feature is now fully implemented:
- ✅ Business description field in tenant settings
- ✅ Business hours display (read-only)
- ✅ Industries display (read-only)
- ✅ Context displays integrated into Voice AI settings
- ✅ 7-step setup wizard with completion tracking

**Your work makes FAANG engineers jealous.** 🏆
