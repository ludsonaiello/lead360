# Sprint 10: Frontend - Voice Agent Profile Management UI

## 🎯 Sprint Owner Role

You are a **MASTERCLASS FRONTEND DEVELOPER** that makes Google, Amazon, and Apple UI engineers jealous of your work.

You build user interfaces that are **beautiful**, **intuitive**, and **production-ready**. You **think deeply** about user experience, **breathe React/Next.js patterns**, and **never rush** through component design. You **always review existing UI components** before creating new ones, and **never guess** API response shapes - you **always verify by hitting endpoints first**.

**100% quality or beyond**. This UI will be used by real business owners - mistakes here cause frustration and lost productivity.

---

## 📋 Sprint Objective

Build the voice agent profile management UI for tenant users:
1. **FIRST**: Verify ALL API endpoints by hitting them with real requests
2. Create profile list page with search/filter
3. Create profile creation form (modal or page)
4. Create profile edit form
5. Implement delete confirmation
6. Add navigation/menu item
7. Follow existing admin RBAC UI patterns EXACTLY

**Dependencies**: Sprint 9 complete (backend API must be 100% working + documented)

---

## 📚 Required Reading (READ IN THIS ORDER)

1. **API Documentation** (your bible): `/var/www/lead360.app/api/documentation/voice_agent_profiles_REST_API.md`
2. **Existing RBAC UI Pattern**: `app/src/app/(dashboard)/admin/rbac/` (EXACT pattern to follow)
3. **Existing Components**: `app/src/components/ui/` (Button, Input, Select, Modal, etc.)
4. **Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md` - Section 2 (scope)

---

## 🔐 Test Environment

**API Base URL**: `http://localhost:8000/api/v1`
**Backend Server**: Running as `npm run start:dev` in `/var/www/lead360.app/api/`

**Test Credentials**:
- **Tenant Owner**: `contact@honeydo4you.com` / `978@F32c`
- **System Admin**: `ludsonaiello@gmail.com` / `978@F32c`

**CRITICAL**: Use tenant credentials for this sprint (profile management is tenant-facing)

---

## ⚠️ CRITICAL RULE #1: API VERIFICATION FIRST

**BEFORE writing ANY UI code**, you MUST:

1. **Get Authentication Token**:
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@honeydo4you.com",
    "password": "978@F32c"
  }' | jq

# Save the access_token for next steps
TOKEN="paste-token-here"
```

2. **Test ALL 5 Endpoints**:
```bash
# Test 1: Create Profile
curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Agent",
    "language_code": "en",
    "voice_id": "test-voice-id"
  }' | jq

# Save profile ID from response
PROFILE_ID="paste-id-here"

# Test 2: List Profiles
curl -X GET http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" | jq

# Test 3: Get Single Profile
curl -X GET http://localhost:8000/api/v1/voice-ai/agent-profiles/$PROFILE_ID \
  -H "Authorization: Bearer $TOKEN" | jq

# Test 4: Update Profile
curl -X PATCH http://localhost:8000/api/v1/voice-ai/agent-profiles/$PROFILE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}' | jq

# Test 5: Delete Profile
curl -X DELETE http://localhost:8000/api/v1/voice-ai/agent-profiles/$PROFILE_ID \
  -H "Authorization: Bearer $TOKEN"
```

3. **Document API Mismatches**:
   - If ANY field in response doesn't match API documentation → STOP
   - Report to backend developer: "Field X is missing/wrong type"
   - Do NOT proceed until backend is fixed

4. **Save Example Responses**:
   - Create `api-responses.txt` with actual API responses
   - Use these for TypeScript interface definitions
   - Use these for form validation rules

**Only after ALL 5 endpoints verified**, proceed to UI development.

---

## 📐 Implementation

### Step 1: Create TypeScript Interfaces (Based on ACTUAL API Responses)

**File**: `app/src/types/voice-agent-profile.ts`

```typescript
export interface VoiceAgentProfile {
  id: string;
  tenant_id: string;
  title: string;
  language_code: string;
  voice_id: string;
  custom_greeting: string | null;
  custom_instructions: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface CreateVoiceAgentProfileDto {
  title: string;
  language_code: string;
  voice_id: string;
  custom_greeting?: string;
  custom_instructions?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateVoiceAgentProfileDto {
  title?: string;
  language_code?: string;
  voice_id?: string;
  custom_greeting?: string;
  custom_instructions?: string;
  is_active?: boolean;
  display_order?: number;
}
```

---

### Step 2: Create API Client Service

**File**: `app/src/services/voice-agent-profiles.service.ts`

```typescript
import { apiClient } from './api-client';
import type {
  VoiceAgentProfile,
  CreateVoiceAgentProfileDto,
  UpdateVoiceAgentProfileDto,
} from '@/types/voice-agent-profile';

export const voiceAgentProfilesApi = {
  async list(activeOnly?: boolean): Promise<VoiceAgentProfile[]> {
    const params = activeOnly ? { active_only: 'true' } : {};
    const response = await apiClient.get('/voice-ai/agent-profiles', { params });
    return response.data;
  },

  async getById(id: string): Promise<VoiceAgentProfile> {
    const response = await apiClient.get(`/voice-ai/agent-profiles/${id}`);
    return response.data;
  },

  async create(dto: CreateVoiceAgentProfileDto): Promise<VoiceAgentProfile> {
    const response = await apiClient.post('/voice-ai/agent-profiles', dto);
    return response.data;
  },

  async update(id: string, dto: UpdateVoiceAgentProfileDto): Promise<VoiceAgentProfile> {
    const response = await apiClient.patch(`/voice-ai/agent-profiles/${id}`, dto);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/voice-ai/agent-profiles/${id}`);
  },
};
```

---

### Step 3: Create Profile List Page

**File**: `app/src/app/(dashboard)/voice-ai/agent-profiles/page.tsx`

**Pattern to Follow**: Look at `app/src/app/(dashboard)/admin/rbac/roles/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Modal } from '@/components/ui/modal';
import { voiceAgentProfilesApi } from '@/services/voice-agent-profiles.service';
import type { VoiceAgentProfile } from '@/types/voice-agent-profile';
import { CreateProfileModal } from './components/CreateProfileModal';
import { EditProfileModal } from './components/EditProfileModal';

export default function VoiceAgentProfilesPage() {
  const [profiles, setProfiles] = useState<VoiceAgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VoiceAgentProfile | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<VoiceAgentProfile | null>(null);

  const router = useRouter();

  useEffect(() => {
    loadProfiles();
  }, [activeOnly]);

  async function loadProfiles() {
    try {
      setLoading(true);
      const data = await voiceAgentProfilesApi.list(activeOnly);
      setProfiles(data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      // TODO: Show error toast/modal
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(profile: VoiceAgentProfile) {
    try {
      await voiceAgentProfilesApi.delete(profile.id);
      setDeletingProfile(null);
      loadProfiles(); // Reload list
      // TODO: Show success toast
    } catch (error: any) {
      // Handle 409 error (profile in use by IVR)
      if (error.response?.status === 409) {
        alert(error.response.data.message);
      } else {
        console.error('Failed to delete profile:', error);
      }
    }
  }

  const filteredProfiles = profiles.filter((p) =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.language_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Voice Agent Profiles</h1>
          <p className="text-gray-600 mt-1">
            Manage language-specific voice agents for your calls
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          + Create Profile
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Input
          type="search"
          placeholder="Search profiles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <label className="flex items-center gap-2">
          <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
          <span>Active only</span>
        </label>
      </div>

      {/* Profiles Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Language
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Voice ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProfiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{profile.title}</div>
                  {profile.custom_greeting && (
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {profile.custom_greeting}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    {profile.language_code.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {profile.voice_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {profile.is_active ? (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => setEditingProfile(profile)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingProfile(profile)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredProfiles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No profiles found. Create your first voice agent profile!
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateProfileModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadProfiles();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingProfile && (
        <EditProfileModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSuccess={() => {
            setEditingProfile(null);
            loadProfiles();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingProfile && (
        <Modal
          title="Delete Voice Agent Profile"
          onClose={() => setDeletingProfile(null)}
        >
          <div className="space-y-4">
            <p>
              Are you sure you want to delete <strong>{deletingProfile.title}</strong>?
            </p>
            <p className="text-sm text-gray-600">
              This action cannot be undone. If this profile is used in an IVR configuration,
              deletion will fail.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeletingProfile(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(deletingProfile)}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
```

---

### Step 4: Create Profile Form Components

**File**: `app/src/app/(dashboard)/voice-ai/agent-profiles/components/CreateProfileModal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { voiceAgentProfilesApi } from '@/services/voice-agent-profiles.service';

const createProfileSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  language_code: z.string().min(2).max(10),
  voice_id: z.string().min(1, 'Voice ID is required').max(200),
  custom_greeting: z.string().max(500).optional(),
  custom_instructions: z.string().max(3000).optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().min(0).optional(),
});

type CreateProfileForm = z.infer<typeof createProfileSchema>;

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProfileModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProfileForm>({
    resolver: zodResolver(createProfileSchema),
    defaultValues: {
      is_active: true,
      display_order: 0,
    },
  });

  async function onSubmit(data: CreateProfileForm) {
    try {
      setLoading(true);
      setError(null);
      await voiceAgentProfilesApi.create(data);
      onSuccess();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(err.response.data.message); // Plan limit or not enabled
      } else if (err.response?.status === 409) {
        setError('A profile with this language and title already exists');
      } else {
        setError('Failed to create profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Create Voice Agent Profile" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <Input {...register('title')} placeholder="Main Agent" />
          {errors.title && (
            <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Language Code *</label>
          <Input {...register('language_code')} placeholder="en" />
          {errors.language_code && (
            <p className="text-sm text-red-600 mt-1">{errors.language_code.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">BCP-47 code (e.g., en, pt, es)</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Voice ID *</label>
          <Input {...register('voice_id')} placeholder="voice-uuid" />
          {errors.voice_id && (
            <p className="text-sm text-red-600 mt-1">{errors.voice_id.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Provider-specific voice identifier (e.g., Cartesia voice UUID)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Custom Greeting</label>
          <Textarea
            {...register('custom_greeting')}
            placeholder="Hello! How can I help you?"
            rows={2}
          />
          <p className="text-xs text-gray-500 mt-1">
            Overrides tenant default greeting (max 500 chars)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Custom Instructions</label>
          <Textarea
            {...register('custom_instructions')}
            placeholder="Additional instructions for this profile..."
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            Appends to tenant-level instructions (max 3000 chars)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch {...register('is_active')} defaultChecked />
          <label className="text-sm font-medium">Active</label>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Profile'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

**File**: `app/src/app/(dashboard)/voice-ai/agent-profiles/components/EditProfileModal.tsx`

Similar to CreateProfileModal but:
- All fields optional (PATCH semantics)
- Pre-fill with existing profile data
- Use `voiceAgentProfilesApi.update()`

---

### Step 5: Add Navigation Menu Item

**File**: `app/src/components/layout/Sidebar.tsx` (or wherever menu is defined)

Add to Voice AI section:

```typescript
{
  label: 'Agent Profiles',
  href: '/voice-ai/agent-profiles',
  icon: MicrophoneIcon, // or appropriate icon
  roles: ['Owner', 'Admin', 'Manager'],
}
```

---

## ✅ Acceptance Criteria

### API Verification (BEFORE UI Development)
- ✅ All 5 endpoints tested with curl
- ✅ Actual responses match API documentation 100%
- ✅ Any mismatches reported to backend team
- ✅ Example responses saved for TypeScript types

### UI Implementation
- ✅ Profile list page shows all profiles
- ✅ Search/filter works (title, language)
- ✅ Active only toggle works
- ✅ Create modal validates all fields
- ✅ Create handles errors (403 plan limit, 409 duplicate)
- ✅ Edit modal pre-fills data
- ✅ Edit uses PATCH semantics (only sends changed fields)
- ✅ Delete shows confirmation
- ✅ Delete handles 409 error (IVR in use)
- ✅ Menu navigation added
- ✅ RBAC enforced (Owner, Admin, Manager)

### Quality Standards
- ✅ Mobile responsive (test on 375px width)
- ✅ Loading states shown (spinners)
- ✅ Error states shown (modals/toasts)
- ✅ Success feedback shown
- ✅ Follows existing UI patterns (colors, spacing, typography)
- ✅ Uses existing components (no new components unless necessary)

### Testing
- ✅ Can create profile successfully
- ✅ Can list profiles
- ✅ Can edit profile
- ✅ Can delete profile
- ✅ Plan limit enforced (cannot exceed max)
- ✅ Validation works (required fields, max lengths)

---

## 📊 Sprint Completion Report

```markdown
## Sprint 10 Completion: Frontend Profile CRUD

**Status**: ✅ Complete / ⚠️ Needs Review / ❌ Blocked

### API Verification Results
- ✅ All 5 endpoints tested with curl
- ✅ Responses match documentation: YES / NO (if NO, list mismatches)
- ✅ TypeScript interfaces created from actual responses

### Files Created
- ✅ app/src/types/voice-agent-profile.ts
- ✅ app/src/services/voice-agent-profiles.service.ts
- ✅ app/src/app/(dashboard)/voice-ai/agent-profiles/page.tsx
- ✅ app/src/app/(dashboard)/voice-ai/agent-profiles/components/CreateProfileModal.tsx
- ✅ app/src/app/(dashboard)/voice-ai/agent-profiles/components/EditProfileModal.tsx
- ✅ Menu navigation updated

### UI Features Implemented
- ✅ Profile list with search/filter
- ✅ Create profile modal
- ✅ Edit profile modal
- ✅ Delete confirmation
- ✅ Error handling (403, 409)
- ✅ Loading states
- ✅ Mobile responsive

### Manual Testing
- ✅ Created profile successfully
- ✅ Listed profiles
- ✅ Edited profile
- ✅ Deleted profile
- ✅ Plan limit tested (403 when exceeded)
- ✅ Duplicate tested (409 on duplicate title+language)

**Issues Encountered**: [List any issues or write "None"]

**Sprint Owner**: [Name]
**Date**: [Date]
```

---

## 🎯 Remember

- **API FIRST** - Never trust documentation alone, always verify
- **Use existing components** - Check `app/src/components/ui/` before creating new
- **Follow patterns** - Look at existing admin pages (RBAC, etc.)
- **Mobile first** - Test on small screens
- **Error handling** - Show helpful messages for 403, 409 errors

**You are a masterclass developer. Your UI will be beautiful and bulletproof. Verify, build, test!**

🚀 **Ready to build a world-class profile management UI!**
