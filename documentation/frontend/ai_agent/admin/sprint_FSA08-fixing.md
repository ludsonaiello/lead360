YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FSA08-fixing — Provider Cost Pricing: Backend + Frontend

**Module**: Voice AI
**Sprint**: FSA08-fixing
**Depends on**: B02a (providers CRUD complete), FSA01 (providers page complete), FSA06 (types file exists)
**Touches**: Backend (migration + DTO + context builder + seed) AND Frontend (types + provider form)

---

## Why This Sprint Exists

The Voice AI module tracks `estimated_cost` per call (in `voice_usage_record`) but had no structured data source for those estimates. The Python agent was expected to send costs but had nothing to calculate them from.

This sprint adds structured cost pricing to the `voice_ai_provider` table, wires it through the admin UI (so Lead360 staff can update pricing when vendors change rates), through the internal context endpoint (so the Python agent receives pricing at call time), and the Python agent uses it to calculate accurate `estimated_cost` per usage record.

**Two separate cost concepts — keep them distinct**:
- `voice_ai_overage_rate` on `subscription_plan` = what Lead360 **charges tenants** (revenue)
- `cost_per_unit` on `voice_ai_provider` = what Lead360 **pays providers** (infrastructure cost)

The Usage Dashboard uses both to show: revenue collected vs. cost incurred per tenant per month.

---

## Mandatory Pre-Coding Steps

> **STOP — DO THESE FIRST OR YOUR TYPES WILL BE WRONG**

1. **Verify the backend is running**: `curl http://localhost:8000/api/v1/health | jq .`

2. **Login and get an admin token**:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')
   echo $TOKEN
   ```

3. **Hit the providers endpoint and inspect the REAL response shape**:
   ```bash
   curl -s http://localhost:8000/api/v1/system/voice-ai/providers \
     -H "Authorization: Bearer $TOKEN" | jq .
   ```
   Check if `cost_per_unit` and `cost_unit` already exist in the response. If not — run the migration first (Task 1 below) then re-check.

4. **Hit the internal context endpoint after migration** (use the voice agent key from `.env` or admin panel):
   ```bash
   curl -s "http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/context" \
     -H "X-Voice-Agent-Key: YOUR_AGENT_KEY" | jq '.providers'
   ```
   Verify `cost_per_unit` and `cost_unit` appear in each provider block.

5. **Read the existing provider types file**: `/app/src/lib/types/voice-ai-admin.ts` — understand the current `VoiceAiProvider` and `CreateProviderRequest` interfaces before touching them.

6. **Read the existing providers page**: `/app/src/app/(dashboard)/admin/voice-ai/providers/page.tsx` — understand the create/edit modal before modifying it.

**DO NOT USE PM2** — run with dev servers:
```bash
# Backend
cd /var/www/lead360.app/api && npm run dev   # port 8000

# Frontend
cd /var/www/lead360.app/app && npm run dev   # port 7000
```

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- DB credentials: `/var/www/lead360.app/api/.env` — **never hardcode**
- Voice Agent Key: from `/var/www/lead360.app/api/.env` (key: `VOICE_AGENT_KEY`)

---

## Reference Files

| What | Where |
|------|-------|
| Existing provider DTO | `/api/src/modules/voice-ai/dto/create-provider.dto.ts` |
| Provider service | `/api/src/modules/voice-ai/services/voice-ai-providers.service.ts` |
| Context builder service | `/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts` |
| Seed file | `/api/prisma/seeds/voice-ai.seed.ts` |
| Admin types file | `/app/src/lib/types/voice-ai-admin.ts` |
| Admin API client | `/app/src/lib/api/voice-ai-admin.ts` |
| Providers page | `/app/src/app/(dashboard)/admin/voice-ai/providers/page.tsx` |
| Prisma schema | `/api/prisma/schema.prisma` |

---

# BACKEND TASKS

---

## Task 1: Prisma Migration — Add Cost Columns to `voice_ai_provider`

Add two structured cost columns to the schema:

**Update `/api/prisma/schema.prisma`** — inside `model voice_ai_provider`, add after `pricing_info`:

```prisma
cost_per_unit     Decimal?  @db.Decimal(12, 8)   // cost per 1 unit in USD (e.g. $0.00000043 per character)
cost_unit         String?   @db.VarChar(20)       // 'per_second' | 'per_token' | 'per_character'
```

**Run migration**:
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_provider_cost_pricing
```

**Verify columns exist**:
```bash
npx prisma db pull   # should show new columns
# OR check DB directly:
mysql -u root -p lead360 -e "DESCRIBE voice_ai_provider;" | grep cost
```

---

## Task 2: Update `CreateProviderDto`

**File**: `/api/src/modules/voice-ai/dto/create-provider.dto.ts`

Add to the existing DTO (after `pricing_info` field):

```typescript
import { IsDecimal, IsNumber, IsPositive } from 'class-validator';

// ... existing fields ...

@IsOptional()
@IsNumber()
@IsPositive()
cost_per_unit?: number;  // USD cost per 1 usage unit — e.g. 0.0000716 for Deepgram (per second)

@IsOptional()
@IsString()
@IsIn(['per_second', 'per_token', 'per_character'])
cost_unit?: string;  // must match usage_unit on voice_usage_record
```

**`UpdateProviderDto` extends `PartialType(CreateProviderDto)` — no changes needed there.**

**Verify the endpoint accepts the new fields**:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# PATCH an existing provider to add cost
curl -s -X PATCH http://localhost:8000/api/v1/system/voice-ai/providers/PROVIDER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cost_per_unit": 0.0000716, "cost_unit": "per_second"}' | jq .
```
Expect the response to include `cost_per_unit` and `cost_unit`.

---

## Task 3: Update Seed File — Populate Pricing for Default Providers

**File**: `/api/prisma/seeds/voice-ai.seed.ts`

Update the three provider upserts to include cost pricing. Use current approximate market rates (admin can update via UI if rates change):

```typescript
// In the providers array, add cost fields:
{
  provider_key: 'deepgram',
  // ... existing fields ...
  cost_per_unit: 0.005,   // $0.0043/min ÷ 60 seconds = $0.0000716/second (Nova-2 streaming)
  cost_unit: 'per_second',    // Deepgram charges per second of audio
},
{
  provider_key: 'openai',
  // ... existing fields ...
  cost_per_unit: 0.004,  // $0.00015 per 1K tokens = $0.00000015/token (gpt-4o-mini input avg)
  cost_unit: 'per_token',     // OpenAI charges per token
},
{
  provider_key: 'cartesia',
  // ... existing fields ...
  cost_per_unit: 0.08,     // ~$0.00001 per character (Sonic English)
  cost_unit: 'per_character', // Cartesia charges per character synthesized
},
```

**Run seed**:
```bash
cd /var/www/lead360.app/api
npx ts-node prisma/seeds/voice-ai.seed.ts
```

**Verify**:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

curl -s http://localhost:8000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN" | jq '.[].cost_per_unit'
# Must NOT return all nulls — should show 0.0000716, 0.00000015, 0.00001
```

---

## Task 4: Update `VoiceAiContextBuilderService` — Include Pricing in Context

**File**: `/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`

The context builder resolves providers and loads their credentials. It must also include `cost_per_unit` and `cost_unit` in the returned provider objects so the Python agent can calculate `estimated_cost` at call completion.

**Update the provider blocks in `FullVoiceAiContext`** (inside `buildContext()`):

Where the service builds the STT/LLM/TTS provider sections, add the two cost fields:

```typescript
// Example for STT provider block — same pattern for LLM and TTS:
stt: sttProvider ? {
  provider_id: sttProvider.id,
  provider_key: sttProvider.provider_key,
  api_key: decryptedSttKey,           // already present
  config: JSON.parse(sttProvider.default_config ?? '{}'),
  cost_per_unit: sttProvider.cost_per_unit    // ADD: Decimal | null
    ? Number(sttProvider.cost_per_unit)       // convert Prisma Decimal → number
    : null,
  cost_unit: sttProvider.cost_unit ?? null,   // ADD: 'per_second' | null
} : null,
```

Apply the same pattern to `llm` and `tts` provider blocks.

**Verify the internal context endpoint returns cost fields**:
```bash
# Get a valid tenant ID from DB first
TENANT_ID="your-tenant-uuid"
AGENT_KEY="your-agent-key-from-env"

curl -s "http://localhost:8000/api/v1/internal/voice-ai/tenant/$TENANT_ID/context" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" | jq '.providers.stt | {provider_key, cost_per_unit, cost_unit}'
# Expect: { "provider_key": "deepgram", "cost_per_unit": 0.0000716, "cost_unit": "per_second" }
```

**IMPORTANT**: Prisma returns `Decimal` for `cost_per_unit` — always wrap in `Number()` before returning from the service. Do not return the raw Prisma Decimal object.

---

# FRONTEND TASKS

---

## Task 5: Update Types — `VoiceAiProvider` and `CreateProviderRequest`

**File**: `/app/src/lib/types/voice-ai-admin.ts`

**HIT THE ENDPOINT FIRST** and verify the real field names before editing:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

curl -s http://localhost:8000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN" | jq '.[0]'
```

Update `VoiceAiProvider` interface — add after `config_schema`:

```typescript
export interface VoiceAiProvider {
  id: string;
  provider_key: string;
  provider_type: 'STT' | 'LLM' | 'TTS';
  display_name: string;
  description: string | null;
  config_schema: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  cost_per_unit: number | null;    // ADD: USD cost per 1 usage unit
  cost_unit: 'per_second' | 'per_token' | 'per_character' | null;  // ADD
}
```

Update `CreateProviderRequest` interface — add at end:

```typescript
export interface CreateProviderRequest {
  provider_key: string;
  provider_type: 'STT' | 'LLM' | 'TTS';
  display_name: string;
  description?: string;
  is_active?: boolean;
  cost_per_unit?: number;    // ADD
  cost_unit?: 'per_second' | 'per_token' | 'per_character';  // ADD
}
```

---

## Task 6: Update Provider Form — Add Pricing Section

**File**: `/app/src/app/(dashboard)/admin/voice-ai/providers/page.tsx`

**HIT THE ENDPOINT FIRST** to see the real provider shape (see Task 5 curl above).

The create/edit provider modal needs a new "Pricing" section added below the existing form fields.

**Zod schema update** — add to the existing provider form schema:

```typescript
const schema = z.object({
  // ... existing fields ...
  cost_per_unit: z.number().positive().optional().nullable(),
  cost_unit: z.enum(['per_second', 'per_token', 'per_character']).optional().nullable(),
}).refine(
  (data) => {
    // Both must be set together, or both must be null
    const hasCost = data.cost_per_unit != null;
    const hasUnit = data.cost_unit != null;
    return hasCost === hasUnit;
  },
  { message: 'Cost per unit and cost unit must both be set or both be empty', path: ['cost_unit'] }
);
```

**Add pricing section to the modal form** (after the existing fields, before Save button):

```tsx
{/* Pricing Section */}
<div className="border-t pt-4 mt-4">
  <h4 className="text-sm font-semibold text-gray-700 mb-3">Provider Pricing</h4>
  <p className="text-xs text-gray-500 mb-3">
    Used to calculate estimated infrastructure cost per call.
    Update when provider changes their pricing.
  </p>

  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Cost per Unit (USD)
      </label>
      <input
        type="number"
        step="0.00000001"
        min="0"
        placeholder="e.g. 0.0000716"
        className="w-full border rounded px-3 py-2 text-sm font-mono"
        {...register('cost_per_unit', { valueAsNumber: true })}
      />
      <p className="text-xs text-gray-400 mt-1">
        {watchedType === 'STT' && 'Cost per second of audio processed'}
        {watchedType === 'LLM' && 'Cost per token (use average of input + output rates)'}
        {watchedType === 'TTS' && 'Cost per character synthesized'}
      </p>
      {errors.cost_per_unit && (
        <p className="text-xs text-red-500 mt-1">{errors.cost_per_unit.message}</p>
      )}
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Billing Unit
      </label>
      <select
        className="w-full border rounded px-3 py-2 text-sm"
        {...register('cost_unit')}
      >
        <option value="">— Select unit —</option>
        <option value="per_second">Per Second (STT audio)</option>
        <option value="per_token">Per Token (LLM)</option>
        <option value="per_character">Per Character (TTS)</option>
      </select>
      {errors.cost_unit && (
        <p className="text-xs text-red-500 mt-1">{errors.cost_unit.message}</p>
      )}
    </div>
  </div>

  {/* Show current rate hint if editing */}
  {editingProvider?.cost_per_unit && (
    <p className="text-xs text-blue-600 mt-2">
      Current rate: ${editingProvider.cost_per_unit.toFixed(8)} {editingProvider.cost_unit}
    </p>
  )}
</div>
```

**Pre-fill on edit** — ensure the modal's `reset()` call includes the new fields:

```typescript
reset({
  // ... existing fields ...
  cost_per_unit: editingProvider.cost_per_unit ?? undefined,
  cost_unit: editingProvider.cost_unit ?? undefined,
});
```

**Test in browser** (`http://localhost:7000`):
1. Login as admin: `ludsonaiello@gmail.com` / `978@F32c`
2. Go to Voice AI → Providers
3. Click edit on Deepgram — pricing section shows `0.0000716` / `per_second`
4. Click edit on OpenAI — shows `0.00000015` / `per_token`
5. Click edit on Cartesia — shows `0.00001` / `per_character`
6. Change a value, save — verify PATCH request succeeds and table reflects new value
7. Try saving with cost_per_unit but no cost_unit — expect validation error
8. Test on mobile 375px — pricing section is responsive

---

## Task 7: Verify End-to-End Data Flow

Run this full verification sequence after completing all tasks:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# 1. Providers list shows cost fields
echo "=== Providers with cost ==="
curl -s http://localhost:8000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN" | jq '[.[] | {key: .provider_key, cost: .cost_per_unit, unit: .cost_unit}]'

# 2. Internal context includes cost fields
echo "=== Context provider cost fields ==="
TENANT_ID="GET_FROM_DB"
AGENT_KEY="GET_FROM_ENV"
curl -s "http://localhost:8000/api/v1/internal/voice-ai/tenant/$TENANT_ID/context" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" | jq '{
    stt_cost: .providers.stt.cost_per_unit,
    stt_unit: .providers.stt.cost_unit,
    llm_cost: .providers.llm.cost_per_unit,
    tts_cost: .providers.tts.cost_per_unit
  }'
```

Both checks must return non-null cost values before marking this sprint complete.

---

## Acceptance Criteria

**Backend**:
- [ ] `voice_ai_provider` table has `cost_per_unit` and `cost_unit` columns (migration applied)
- [ ] `GET /api/v1/system/voice-ai/providers` returns `cost_per_unit` and `cost_unit` per provider
- [ ] `PATCH /api/v1/system/voice-ai/providers/:id` accepts and persists `cost_per_unit` and `cost_unit`
- [ ] `GET /api/v1/internal/voice-ai/tenant/:tenantId/context` includes `cost_per_unit` and `cost_unit` in each provider block (stt, llm, tts) — as `number | null`, NOT as Prisma Decimal
- [ ] Seed populates all 3 default providers with correct cost data
- [ ] Non-admin gets 403 on all system/* endpoints
- [ ] `npm run build` passes

**Frontend**:
- [ ] `VoiceAiProvider` interface has `cost_per_unit: number | null` and `cost_unit: '...' | null`
- [ ] `CreateProviderRequest` has optional `cost_per_unit` and `cost_unit`
- [ ] Provider create modal shows pricing section with cost input + unit select
- [ ] Provider edit modal pre-fills current pricing values
- [ ] Validation: both cost_per_unit + cost_unit must be set together (or both null)
- [ ] Helper text changes based on provider type (per second / per token / per character)
- [ ] Mobile layout correct at 375px
- [ ] No TypeScript errors (`npm run build`)
