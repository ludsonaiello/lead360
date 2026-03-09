import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const defaultProfiles = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    language_code: 'en',
    language_name: 'English',
    voice_id: 'e07c00bc-4134-4eae-9ea4-1a55fb45746b',
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
    voice_id: '700d1ee3-a641-4018-ba6e-899dcadc9e2b',
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
    voice_id: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c',
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
