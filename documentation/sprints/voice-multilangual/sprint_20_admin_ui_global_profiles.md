# Sprint 20: Admin UI - Global Profile Management
## Voice Multilingual Architecture Fix

**Sprint Number**: 20 of 21
**Sprint Owner**: Frontend Specialist - Admin Portal
**Estimated Effort**: 6-7 hours
**Prerequisites**: Sprints 16-19 complete (backend + API docs ready)

---

## Sprint Owner Role

You are a **masterclass Frontend Specialist** from Google/Amazon/Apple level. You build production-ready, modern UI that users love. You NEVER GUESS endpoints - you read API documentation, test with Postman first, then implement. You handle errors gracefully with modals, never with console.log.

---

## Goal

Build admin portal pages for managing global voice agent profiles:
1. **List page** - Table of all global profiles
2. **Create page** - Form to create new global profile
3. **Edit page** - Form to update existing profile
4. **Delete action** - Soft delete with confirmation modal

---

## Task 1: Review API Documentation

**CRITICAL**: Before coding, read and test:
- **File**: `/api/documentation/voice_agent_profiles_REST_API.md`
- **Test**: All admin endpoints with Postman/curl
- **Understand**: Request/response shapes, error codes, validation rules

---

## Task 2: Create API Client Functions

**File**: `/app/src/lib/api/voice-ai-admin.ts`

```typescript
import { apiClient } from './client';

export interface GlobalAgentProfile {
  id: string;
  language_code: string;
  language_name: string;
  voice_id: string;
  voice_provider_type: string;
  display_name: string;
  description?: string;
  default_greeting?: string;
  default_instructions?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  updated_by?: string;
  _count?: {
    tenant_overrides: number;
  };
}

export interface CreateGlobalProfileDto {
  language_code: string;
  language_name: string;
  voice_id: string;
  voice_provider_type?: string;
  display_name: string;
  description?: string;
  default_greeting?: string;
  default_instructions?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateGlobalProfileDto extends Partial<CreateGlobalProfileDto> {}

export const voiceAiAdminApi = {
  globalProfiles: {
    list: async (activeOnly = false): Promise<GlobalAgentProfile[]> => {
      const response = await apiClient.get(
        `/system/voice-ai/agent-profiles?active_only=${activeOnly}`
      );
      return response.data;
    },

    create: async (data: CreateGlobalProfileDto): Promise<GlobalAgentProfile> => {
      const response = await apiClient.post('/system/voice-ai/agent-profiles', data);
      return response.data;
    },

    get: async (id: string): Promise<GlobalAgentProfile> => {
      const response = await apiClient.get(`/system/voice-ai/agent-profiles/${id}`);
      return response.data;
    },

    update: async (id: string, data: UpdateGlobalProfileDto): Promise<GlobalAgentProfile> => {
      const response = await apiClient.patch(`/system/voice-ai/agent-profiles/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/system/voice-ai/agent-profiles/${id}`);
    },
  },
};
```

---

## Task 3: Create Page Routes

**Structure**:
```
app/src/app/(dashboard)/admin/voice-ai/agent-profiles/
├── page.tsx                     (List all profiles)
├── new/
│   └── page.tsx                 (Create new profile)
└── [id]/
    └── edit/
        └── page.tsx             (Edit existing profile)
```

---

## Task 4: Build List Page

**File**: `/app/src/app/(dashboard)/admin/voice-ai/agent-profiles/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { voiceAiAdminApi, GlobalAgentProfile } from '@/lib/api/voice-ai-admin';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

export default function GlobalProfilesListPage() {
  const [profiles, setProfiles] = useState<GlobalAgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadProfiles();
  }, [showInactive]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await voiceAiAdminApi.globalProfiles.list(!showInactive);
      setProfiles(data);
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

  const handleDelete = async (profile: GlobalAgentProfile) => {
    if (!confirm(`Delete profile "${profile.display_name}"? This will deactivate it.`)) {
      return;
    }

    try {
      await voiceAiAdminApi.globalProfiles.delete(profile.id);
      toast({
        title: 'Success',
        description: 'Profile deleted successfully',
      });
      loadProfiles();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete profile',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Global Voice Agent Profiles</h1>
        <Button onClick={() => router.push('/admin/voice-ai/agent-profiles/new')}>
          Create Profile
        </Button>
      </div>

      <div className="mb-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          <span>Show inactive profiles</span>
        </label>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Display Name</th>
              <th className="p-2 text-left">Language</th>
              <th className="p-2 text-left">Voice ID</th>
              <th className="p-2 text-left">Active</th>
              <th className="p-2 text-left">Tenant Usage</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-t">
                <td className="p-2">{profile.display_name}</td>
                <td className="p-2">
                  {profile.language_name} ({profile.language_code})
                </td>
                <td className="p-2 text-sm text-gray-600">{profile.voice_id}</td>
                <td className="p-2">
                  {profile.is_active ? (
                    <span className="text-green-600">✓ Active</span>
                  ) : (
                    <span className="text-red-600">✗ Inactive</span>
                  )}
                </td>
                <td className="p-2">{profile._count?.tenant_overrides || 0} tenants</td>
                <td className="p-2 space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      router.push(`/admin/voice-ai/agent-profiles/${profile.id}/edit`)
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(profile)}
                    disabled={!!profile._count?.tenant_overrides}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## Task 5: Build Create/Edit Form

**File**: `/app/src/app/(dashboard)/admin/voice-ai/agent-profiles/new/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { voiceAiAdminApi } from '@/lib/api/voice-ai-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

export default function CreateGlobalProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    language_code: '',
    language_name: '',
    voice_id: '',
    display_name: '',
    description: '',
    default_greeting: '',
    default_instructions: '',
    is_active: true,
    display_order: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await voiceAiAdminApi.globalProfiles.create(formData);
      toast({
        title: 'Success',
        description: 'Global profile created successfully',
      });
      router.push('/admin/voice-ai/agent-profiles');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Create Global Voice Agent Profile</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Language Code *</label>
          <Input
            value={formData.language_code}
            onChange={(e) => setFormData({ ...formData, language_code: e.target.value })}
            placeholder="en"
            required
            maxLength={10}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Language Name *</label>
          <Input
            value={formData.language_name}
            onChange={(e) => setFormData({ ...formData, language_name: e.target.value })}
            placeholder="English"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Voice ID *</label>
          <Input
            value={formData.voice_id}
            onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
            placeholder="cartesia-voice-uuid"
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Display Name *</label>
          <Input
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="English - Professional"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Professional English voice for business calls"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Default Greeting</label>
          <Textarea
            value={formData.default_greeting}
            onChange={(e) => setFormData({ ...formData, default_greeting: e.target.value })}
            placeholder="Hello, thank you for calling {business_name}!"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Default Instructions</label>
          <Textarea
            value={formData.default_instructions}
            onChange={(e) =>
              setFormData({ ...formData, default_instructions: e.target.value })
            }
            placeholder="You are a professional phone assistant..."
            rows={4}
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          />
          <label htmlFor="is_active">Active</label>
        </div>

        <div className="flex space-x-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Profile'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**Edit page**: Similar to create, but load existing data on mount.

---

## Acceptance Criteria

- [ ] Admin can list all global profiles (with inactive toggle)
- [ ] Admin can create new global profile
- [ ] Admin can edit existing profile
- [ ] Admin can soft-delete profile (with confirmation)
- [ ] Error handling works (modals for errors)
- [ ] Success feedback shown (toasts)
- [ ] Form validation works (required fields, max length)
- [ ] Mobile responsive

---

**Next Sprint**: 21 - Tenant UI + IVR Builder Update

---

**Sprint Status**: Ready to Execute
