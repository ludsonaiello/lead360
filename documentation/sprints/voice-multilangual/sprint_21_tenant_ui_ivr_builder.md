# Sprint 21: Tenant UI + IVR Builder Update
## Voice Multilingual Architecture Fix - FINAL SPRINT

**Sprint Number**: 21 of 21
**Sprint Owner**: Frontend Specialist - Tenant Portal
**Estimated Effort**: 7-8 hours
**Prerequisites**: All previous sprints complete (backend + admin UI ready)

---

## Sprint Owner Role

You are a **masterclass Frontend Specialist** that makes Google, Amazon, and Apple jealous. You build production-ready, user-friendly UI. You NEVER GUESS - you test APIs first, handle all error cases, and create intuitive flows that users love. This is the FINAL sprint - finish strong!

---

## Goal

Update tenant-facing UI to work with the new global profile + override architecture:

1. **List available profiles** - Show global profiles (read-only)
2. **Create override** - Tenant selects global profile + customizes
3. **Edit override** - Update tenant's customizations
4. **IVR builder** - Profile selector shows global profiles

---

## Task 1: Create Tenant API Client

**File**: `/app/src/lib/api/voice-ai-tenant.ts`

```typescript
import { apiClient } from './client';

export interface AvailableGlobalProfile {
  id: string;
  language_code: string;
  language_name: string;
  voice_id: string;
  display_name: string;
  description?: string;
  default_greeting?: string;
  default_instructions?: string;
  is_active: boolean;
  display_order: number;
}

export interface TenantOverride {
  id: string;
  tenant_id: string;
  agent_profile_id: string;
  custom_greeting?: string;
  custom_instructions?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  agent_profile: AvailableGlobalProfile;
}

export interface CreateOverrideDto {
  agent_profile_id: string;
  custom_greeting?: string;
  custom_instructions?: string;
  is_active?: boolean;
}

export interface UpdateOverrideDto extends Partial<Omit<CreateOverrideDto, 'agent_profile_id'>> {}

export const voiceAiTenantApi = {
  availableProfiles: {
    list: async (activeOnly = true): Promise<AvailableGlobalProfile[]> => {
      const response = await apiClient.get(
        `/voice-ai/available-profiles?active_only=${activeOnly}`
      );
      return response.data;
    },
  },

  overrides: {
    list: async (activeOnly = false): Promise<TenantOverride[]> => {
      const response = await apiClient.get(
        `/voice-ai/agent-profile-overrides?active_only=${activeOnly}`
      );
      return response.data;
    },

    create: async (data: CreateOverrideDto): Promise<TenantOverride> => {
      const response = await apiClient.post('/voice-ai/agent-profile-overrides', data);
      return response.data;
    },

    get: async (id: string): Promise<TenantOverride> => {
      const response = await apiClient.get(`/voice-ai/agent-profile-overrides/${id}`);
      return response.data;
    },

    update: async (id: string, data: UpdateOverrideDto): Promise<TenantOverride> => {
      const response = await apiClient.patch(
        `/voice-ai/agent-profile-overrides/${id}`,
        data
      );
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/voice-ai/agent-profile-overrides/${id}`);
    },
  },
};
```

---

## Task 2: Build Tenant Profile Management Page

**File**: `/app/src/app/(dashboard)/voice-ai/agent-profiles/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { voiceAiTenantApi, AvailableGlobalProfile, TenantOverride } from '@/lib/api/voice-ai-tenant';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

export default function TenantProfilesPage() {
  const [availableProfiles, setAvailableProfiles] = useState<AvailableGlobalProfile[]>([]);
  const [overrides, setOverrides] = useState<TenantOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [available, myOverrides] = await Promise.all([
        voiceAiTenantApi.availableProfiles.list(true),
        voiceAiTenantApi.overrides.list(false),
      ]);
      setAvailableProfiles(available);
      setOverrides(myOverrides);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load profiles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getOverrideForProfile = (profileId: string) => {
    return overrides.find((o) => o.agent_profile_id === profileId);
  };

  const handleCustomize = (profile: AvailableGlobalProfile) => {
    const override = getOverrideForProfile(profile.id);
    if (override) {
      router.push(`/voice-ai/agent-profiles/${override.id}/edit`);
    } else {
      router.push(`/voice-ai/agent-profiles/new?profile=${profile.id}`);
    }
  };

  const handleDelete = async (override: TenantOverride) => {
    if (!confirm('Delete this customization? You can recreate it later.')) return;

    try {
      await voiceAiTenantApi.overrides.delete(override.id);
      toast({ title: 'Success', description: 'Customization deleted' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-8">
      {/* Available Profiles Section */}
      <section>
        <h1 className="text-2xl font-bold mb-4">Available Voice Agent Profiles</h1>
        <p className="text-gray-600 mb-6">
          Select a profile to customize for your business. These are managed by the platform.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableProfiles.map((profile) => {
            const override = getOverrideForProfile(profile.id);
            return (
              <Card key={profile.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold">{profile.display_name}</h3>
                  {override && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Customized
                    </span>
                  )}
                </div>

                <div className="text-sm text-gray-600 mb-3">
                  <div>Language: {profile.language_name}</div>
                  {profile.description && <div className="mt-1">{profile.description}</div>}
                </div>

                <details className="text-sm mb-3">
                  <summary className="cursor-pointer text-blue-600">View defaults</summary>
                  <div className="mt-2 p-2 bg-gray-50 rounded">
                    <div className="font-medium">Greeting:</div>
                    <div className="text-gray-700">
                      {profile.default_greeting || 'None'}
                    </div>
                    <div className="font-medium mt-2">Instructions:</div>
                    <div className="text-gray-700">
                      {profile.default_instructions || 'None'}
                    </div>
                  </div>
                </details>

                <Button size="sm" onClick={() => handleCustomize(profile)} className="w-full">
                  {override ? 'Edit Customization' : 'Customize'}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      {/* My Customizations Section */}
      {overrides.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">My Customized Profiles</h2>

          <div className="space-y-4">
            {overrides.map((override) => (
              <Card key={override.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-bold mb-1">
                      {override.agent_profile.display_name}
                    </h3>
                    <div className="text-sm text-gray-600">
                      {override.custom_greeting && (
                        <div className="mb-1">
                          <span className="font-medium">Custom Greeting:</span>{' '}
                          {override.custom_greeting}
                        </div>
                      )}
                      {override.custom_instructions && (
                        <div>
                          <span className="font-medium">Custom Instructions:</span>{' '}
                          {override.custom_instructions}
                        </div>
                      )}
                      {!override.custom_greeting && !override.custom_instructions && (
                        <span className="text-gray-400">Using global defaults</span>
                      )}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          override.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {override.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(`/voice-ai/agent-profiles/${override.id}/edit`)
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(override)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

---

## Task 3: Build Create/Edit Override Forms

**File**: `/app/src/app/(dashboard)/voice-ai/agent-profiles/new/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { voiceAiTenantApi, AvailableGlobalProfile } from '@/lib/api/voice-ai-tenant';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

export default function CreateOverridePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profile');

  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<AvailableGlobalProfile | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<AvailableGlobalProfile[]>([]);
  const [formData, setFormData] = useState({
    agent_profile_id: profileId || '',
    custom_greeting: '',
    custom_instructions: '',
    is_active: true,
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (formData.agent_profile_id) {
      const profile = availableProfiles.find((p) => p.id === formData.agent_profile_id);
      setSelectedProfile(profile || null);
    }
  }, [formData.agent_profile_id, availableProfiles]);

  const loadProfiles = async () => {
    try {
      const profiles = await voiceAiTenantApi.availableProfiles.list(true);
      setAvailableProfiles(profiles);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load profiles',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await voiceAiTenantApi.overrides.create(formData);
      toast({
        title: 'Success',
        description: 'Profile customization created successfully',
      });
      router.push('/voice-ai/agent-profiles');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create customization',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Customize Voice Agent Profile</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Selector */}
        <div>
          <label className="block text-sm font-medium mb-2">Select Profile *</label>
          <select
            className="w-full border rounded p-2"
            value={formData.agent_profile_id}
            onChange={(e) =>
              setFormData({ ...formData, agent_profile_id: e.target.value })
            }
            required
          >
            <option value="">-- Select a profile --</option>
            {availableProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.display_name} ({profile.language_name})
              </option>
            ))}
          </select>
        </div>

        {/* Show defaults for selected profile */}
        {selectedProfile && (
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-medium mb-2">Default Settings</h3>
            <div className="text-sm text-gray-700 space-y-2">
              <div>
                <span className="font-medium">Default Greeting:</span>
                <div className="mt-1">{selectedProfile.default_greeting || 'None'}</div>
              </div>
              <div>
                <span className="font-medium">Default Instructions:</span>
                <div className="mt-1">{selectedProfile.default_instructions || 'None'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Greeting */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Custom Greeting (Optional)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Leave empty to use the default. Use {'{business_name}'} as a placeholder.
          </p>
          <Textarea
            value={formData.custom_greeting}
            onChange={(e) =>
              setFormData({ ...formData, custom_greeting: e.target.value })
            }
            placeholder="Welcome to our business! How can we help?"
            rows={3}
          />
        </div>

        {/* Custom Instructions */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Custom Instructions (Optional)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Leave empty to use the default. Provide specific guidance for your business.
          </p>
          <Textarea
            value={formData.custom_instructions}
            onChange={(e) =>
              setFormData({ ...formData, custom_instructions: e.target.value })
            }
            placeholder="Mention our 24/7 emergency service..."
            rows={5}
          />
        </div>

        {/* Active Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          />
          <label htmlFor="is_active">Activate immediately</label>
        </div>

        {/* Actions */}
        <div className="flex space-x-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Customization'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**Edit page**: Similar structure, but load existing override data.

---

## Task 4: Update IVR Builder

**File**: `/app/src/components/communication/ivr/IvrActionConfig.tsx` (or similar)

**Change**: Profile selector for `voice_ai` action

**OLD** (Sprint 1-12):
```typescript
// Showed tenant's own profiles
const profiles = await fetch('/api/v1/voice-ai/agent-profiles');
```

**NEW** (This Sprint):
```typescript
// Shows GLOBAL profiles (read-only)
const profiles = await voiceAiTenantApi.availableProfiles.list(true);

// In dropdown:
<select value={action.config?.agent_profile_id} onChange={...}>
  <option value="">-- Use default --</option>
  {profiles.map((profile) => (
    <option key={profile.id} value={profile.id}>
      {profile.display_name} ({profile.language_name})
    </option>
  ))}
</select>
```

---

## Acceptance Criteria (FINAL SPRINT)

- [ ] Tenant can view available global profiles (read-only)
- [ ] Tenant can create override with custom greeting/instructions
- [ ] Tenant can edit existing override
- [ ] Tenant can delete override
- [ ] Tenant can see which profiles are customized (badge)
- [ ] IVR builder shows global profiles in dropdown
- [ ] Plan limit enforced (error modal if exceeded)
- [ ] Error handling works (modals for all errors)
- [ ] Success feedback shown (toasts)
- [ ] Mobile responsive
- [ ] All tests passing

---

## Final Verification Checklist

**End-to-End Flow**:
1. [ ] Admin creates global profile "English - Professional"
2. [ ] Tenant sees profile in available list
3. [ ] Tenant creates override with custom greeting
4. [ ] Tenant selects profile in IVR builder
5. [ ] Test call initiated
6. [ ] Context includes global voice + tenant greeting
7. [ ] Call works correctly with merged settings

**All Sprints Complete**:
- [ ] Sprint 13: Data reviewed ✅
- [ ] Sprint 14: Schema migrated ✅
- [ ] Sprint 15: Data migrated ✅
- [ ] Sprint 16: Admin API ✅
- [ ] Sprint 17: Tenant API ✅
- [ ] Sprint 18: Context builder ✅
- [ ] Sprint 19: API docs ✅
- [ ] Sprint 20: Admin UI ✅
- [ ] Sprint 21: Tenant UI + IVR ✅

---

## 🎉 Congratulations!

You've completed the Voice Multilingual Architecture Fix. The platform now has a clean, scalable architecture where:
- System admins manage global language templates
- Tenants select and customize profiles
- Plan limits are properly enforced
- Multi-tenant isolation is maintained

**Well done!**

---

**Sprint Status**: Ready to Execute - FINAL SPRINT!
