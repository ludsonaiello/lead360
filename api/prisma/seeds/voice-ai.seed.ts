import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Voice AI Seed
 *
 * Seeds the singleton global config row and the three default AI providers:
 *   - Deepgram (STT)
 *   - OpenAI (LLM)
 *   - Cartesia (TTS)
 *
 * Idempotent: Can be run multiple times safely via upsert.
 */

async function seedVoiceAi(): Promise<void> {
  console.log('Seeding Voice AI global config...');

  // Singleton global config — id is always 'default'
  await prisma.voice_ai_global_config.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      default_language: 'en',
      default_languages: JSON.stringify(['en']),
      default_tools_enabled: JSON.stringify({
        booking: true,
        lead_creation: true,
        call_transfer: true,
      }),
      default_transfer_behavior: 'end_call',
    },
  });

  console.log('Seeded voice_ai_global_config (id=default)');

  // Three default providers
  const providers: Array<{
    provider_key: string;
    provider_type: string;
    display_name: string;
    description: string;
    logo_url: string;
    documentation_url: string;
    capabilities: string;
    default_config: string;
    config_schema: string;
    cost_per_unit: number;
    cost_unit: string;
  }> = [
    {
      provider_key: 'deepgram',
      provider_type: 'STT',
      display_name: 'Deepgram',
      description: 'State-of-the-art speech recognition with Nova-2 model',
      logo_url: 'https://deepgram.com/favicon.ico',
      documentation_url: 'https://developers.deepgram.com',
      capabilities: JSON.stringify([
        'streaming',
        'multilingual',
        'punctuation',
        'diarization',
      ]),
      default_config: JSON.stringify({
        model: 'nova-2',
        punctuate: true,
        interim_results: true,
      }),
      config_schema: JSON.stringify({
        type: 'object',
        properties: {
          model: {
            type: 'string',
            enum: ['nova-2', 'nova-2-general', 'nova-2-phonecall'],
            default: 'nova-2',
          },
          punctuate: { type: 'boolean', default: true },
          interim_results: { type: 'boolean', default: true },
        },
      }),
      cost_per_unit: 0.005,     // $0.0043/min ÷ 60 seconds = ~$0.0000716/second (Nova-2 streaming)
      cost_unit: 'per_second',  // Deepgram charges per second of audio
    },
    {
      provider_key: 'openai',
      provider_type: 'LLM',
      display_name: 'OpenAI',
      description: 'GPT-4o-mini optimized for low-latency voice conversations',
      logo_url: 'https://openai.com/favicon.ico',
      documentation_url: 'https://platform.openai.com/docs',
      capabilities: JSON.stringify([
        'function_calling',
        'streaming',
        'multilingual',
      ]),
      default_config: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 500,
      }),
      config_schema: JSON.stringify({
        type: 'object',
        properties: {
          model: {
            type: 'string',
            enum: ['gpt-4o-mini', 'gpt-4o'],
            default: 'gpt-4o-mini',
          },
          temperature: {
            type: 'number',
            minimum: 0,
            maximum: 2,
            default: 0.7,
          },
          max_tokens: {
            type: 'integer',
            minimum: 100,
            maximum: 4096,
            default: 500,
          },
        },
      }),
      cost_per_unit: 0.004,    // $0.00015 per 1K tokens = ~$0.00000015/token (gpt-4o-mini avg)
      cost_unit: 'per_token',  // OpenAI charges per token
    },
    {
      provider_key: 'cartesia',
      provider_type: 'TTS',
      display_name: 'Cartesia',
      description: 'Ultra-low latency neural text-to-speech with natural voices',
      logo_url: 'https://cartesia.ai/favicon.ico',
      documentation_url: 'https://docs.cartesia.ai',
      capabilities: JSON.stringify([
        'streaming',
        'voice_cloning',
        'multilingual',
        'emotion',
      ]),
      default_config: JSON.stringify({
        model: 'sonic-english',
        speed: 1.0,
        emotion: [],
      }),
      config_schema: JSON.stringify({
        type: 'object',
        properties: {
          model: {
            type: 'string',
            enum: ['sonic-english', 'sonic-multilingual'],
            default: 'sonic-english',
          },
          speed: {
            type: 'number',
            minimum: 0.5,
            maximum: 2.0,
            default: 1.0,
          },
        },
      }),
      cost_per_unit: 0.08,          // ~$0.00001 per character (Sonic English)
      cost_unit: 'per_character',   // Cartesia charges per character synthesized
    },
  ];

  for (const provider of providers) {
    await prisma.voice_ai_provider.upsert({
      where: { provider_key: provider.provider_key },
      update: provider,
      create: provider,
    });
    console.log(`Seeded voice_ai_provider: ${provider.provider_key} (${provider.provider_type})`);
  }

  console.log('Voice AI seeding complete.');
}

seedVoiceAi()
  .catch((error) => {
    console.error('Voice AI seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
