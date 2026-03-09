# Sprint 15: Seed Default Data (CLEAN UPGRADE)
## Voice Multilingual Architecture

**Sprint 15** (SIMPLIFIED)
**Effort**: 30 minutes
**Type**: CLEAN UPGRADE

---

## Goal

Seed database with default global profiles. Simple!

---

## Task: Create Default Profiles

**Script**: `api/scripts/seed-global-profiles.ts`

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const defaultProfiles = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    language_code: 'en',
    language_name: 'English',
    voice_id: 'cartesia-en-US-professional', // TODO: Update with real voice ID
    display_name: 'English - Professional',
    description: 'Professional English voice for business calls',
    default_greeting: 'Hello, thank you for calling {business_name}! How can I help you today?',
    default_instructions: 'You are a professional phone assistant. Be concise, friendly, and helpful.',
    is_active: true,
    display_order: 1,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    language_code: 'pt',
    language_name: 'Portuguese',
    voice_id: 'cartesia-pt-BR-friendly', // TODO: Update with real voice ID
    display_name: 'Portuguese - Friendly',
    description: 'Friendly Brazilian Portuguese voice',
    default_greeting: 'Olá, obrigado por ligar para {business_name}! Como posso ajudá-lo hoje?',
    default_instructions: 'Você é um assistente telefônico amigável. Seja conciso, amigável e prestativo.',
    is_active: true,
    display_order: 2,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    language_code: 'es',
    language_name: 'Spanish',
    voice_id: 'cartesia-es-ES-formal', // TODO: Update with real voice ID
    display_name: 'Spanish - Formal',
    description: 'Formal Spanish voice',
    default_greeting: 'Hola, gracias por llamar a {business_name}! ¿Cómo puedo ayudarle?',
    default_instructions: 'Eres un asistente telefónico profesional. Sé conciso, amable y servicial.',
    is_active: true,
    display_order: 3,
  },
];

async function seed() {
  console.log('🌱 Seeding global profiles...\n');

  for (const profile of defaultProfiles) {
    await prisma.voice_ai_agent_profile.upsert({
      where: { id: profile.id },
      update: profile,
      create: profile,
    });
    console.log(`✅ ${profile.display_name}`);
  }

  console.log('\n✅ Seeding complete!\n');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run**:
```bash
npx ts-node scripts/seed-global-profiles.ts
```

**Verify**:
```bash
mysql -u lead360_user -p -e "
SELECT display_name, language_code FROM voice_ai_agent_profile;
"
```

**Expected**: 3 profiles (en, pt, es)

---

## Acceptance Criteria

- [ ] 3 default profiles created
- [ ] All languages present (en, pt, es)
- [ ] All fields populated

---

**Next**: Sprint 16 - Admin Controller

**Status**: DONE ✅
