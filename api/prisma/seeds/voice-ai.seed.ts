import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Voice AI Seed
 *
 * Seeds the singleton global config row and the default AI provider catalog:
 *   - Deepgram (STT)
 *   - ElevenLabs STT (STT)
 *   - OpenAI (LLM)
 *   - Claude (LLM)
 *   - Cartesia (TTS)
 *   - ElevenLabs TTS (TTS)
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

  // Default provider catalog (STT, TTS and LLM)
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
    },
    {
      provider_key: 'cartesia',
      provider_type: 'TTS',
      display_name: 'Cartesia',
      description:
        'Ultra-low latency neural text-to-speech with natural voices',
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
    },
    {
      provider_key: 'elevenlabs_stt',
      provider_type: 'STT',
      display_name: 'ElevenLabs STT',
      description:
        'ElevenLabs Scribe v2 Realtime — multilingual streaming STT with native end-of-turn detection. Supports 30+ languages.',
      logo_url:
        'https://11labs-nonprd-15f22c1d.s3.eu-west-3.amazonaws.com/a2ea339b-8b5e-41bb-b706-24eda8a4c9e3/elevenlabs-symbol.png',
      documentation_url:
        'https://elevenlabs.io/docs/api-reference/speech-to-text',
      capabilities: JSON.stringify([
        'streaming',
        'multilingual',
        'realtime',
        'end-of-turn-detection',
      ]),
      default_config: JSON.stringify({
        model_id: 'scribe_v2_realtime',
        language_code: 'en',
        audio_format: 'pcm_16000',
        commit_strategy: 'vad',
        vad_silence_threshold_secs: 1.5,
        vad_threshold: 0.5,
        min_speech_duration_ms: 100,
        min_silence_duration_ms: 100,
        enable_logging: true,
      }),
      config_schema: JSON.stringify({
        type: 'object',
        properties: {
          model_id: {
            type: 'string',
            description: 'Models available',
            default: 'scribe_v2_realtime',
            enum: ['scribe_v2_realtime'],
          },
          language_code: {
            type: 'string',
            default: 'en',
            enum: ['en', 'pt', 'es', 'auto-detect'],
          },
          audio_format: {
            type: 'string',
            description:
              'The audio encoding format being sent over the WebSocket. ',
            default: 'pcm_16000',
            enum: [
              'pcm_16000',
              'pcm_22050',
              'pcm_24000',
              'pcm_44100',
              'mulaw_8000',
            ],
          },
          commit_strategy: {
            type: 'string',
            description:
              'Controls how the model decides when a speech segment is complete and emits a committed_transcript.',
            default: 'vad',
            enum: ['manual', 'vad'],
          },
          vad_silence_threshold_secs: {
            type: 'number',
            description:
              'Only active when commit_strategy is vad. How many seconds of silence ElevenLabs waits before deciding the caller has finished speaking and committing the transcript. Lower values = faster response but more risk of cutting off slow speakers. Higher values = more natural pauses allowed but slower agent response.',
            default: 1.5,
            minimum: 0.3,
            maximum: 3,
          },
          vad_threshold: {
            type: 'number',
            description:
              'Only active when commit_strategy is vad. The sensitivity of the voice activity detector. Lower values = more sensitive (detects quieter speech, but more background noise false positives). Higher values = less sensitive (ignores noise better, but may miss soft-spoken callers).',
            default: 0.5,
            minimum: 0.1,
            maximum: 0.9,
          },
          min_speech_duration_ms: {
            type: 'number',
            description:
              'Only active when commit_strategy is vad. The minimum duration of audio that must be detected as speech before ElevenLabs starts a transcription segment.',
            default: 100,
            minimum: 50,
            maximum: 2000,
          },
          min_silence_duration_ms: {
            type: 'number',
            description:
              'Only active when commit_strategy is vad. The minimum duration of silence required to be considered a true silence gap between speech segments. Prevents brief pauses mid-sentence from prematurely committing a transcript. Works together with vad_silence_threshold_secs — think of this as the confirmation window.',
            default: 100,
            minimum: 50,
            maximum: 2000,
          },
          enable_logging: {
            type: 'boolean',
            description:
              "When set to false, activates Zero Retention Mode — ElevenLabs does not log or store any audio or transcript data from the session. History features become unavailable. This is an enterprise-only feature. For Lead360's current plan tier this should remain true. Worth noting as a future setting if enterprise clients require HIPAA or GDPR zero-retention compliance.",
            default: true,
          },
        },
        required: ['model_id', 'language_code'],
      }),
    },
    {
      provider_key: 'elevenlabs_tts',
      provider_type: 'TTS',
      display_name: 'ElevenLabs TTS',
      description: 'Text to Speech ElevenLabs provider',
      logo_url:
        'https://11labs-nonprd-15f22c1d.s3.eu-west-3.amazonaws.com/a2ea339b-8b5e-41bb-b706-24eda8a4c9e3/elevenlabs-symbol.png',
      documentation_url:
        'https://elevenlabs.io/docs/overview/capabilities/text-to-speech',
      capabilities: JSON.stringify(null),
      default_config: JSON.stringify({
        model_id: 'eleven_flash_v2_5',
        language_code: 'en',
        output_format: 'pcm_16000',
        enable_ssml_parsing: false,
        apply_text_normalization: 'on',
        inactivity_timeout: 20,
        auto_mode: false,
        enable_logging: true,
        'voice_settings.stability': 0.5,
        'voice_settings.similarity_boost': 0.75,
        'voice_settings.style': 0.2,
      }),
      config_schema: JSON.stringify({
        type: 'object',
        properties: {
          model_id: {
            type: 'string',
            description:
              'Flash V2.5 Real-time agents, chatbots, telephony /  eleven_turbo_v2_5 Balanced quality + speed / eleven_multilingual_v2 High-quality, emotionally rich output',
            default: 'eleven_flash_v2_5',
            enum: [
              'eleven_flash_v2_5',
              'eleven_turbo_v2_5',
              'eleven_multilingual_v2',
            ],
          },
          language_code: {
            type: 'string',
            description:
              'When provided, helps the model stay in the target language rather than auto-detecting. ',
            default: 'en',
            enum: ['en', 'es', 'pt'],
          },
          output_format: {
            type: 'string',
            description:
              'The audio encoding format returned by the API. pcm_16000 is the correct value to match the LiveKit audio pipeline.',
            default: 'pcm_16000',
            enum: [
              'pcm_16000',
              'pcm_22050',
              'pcm_24000',
              'pcm_44100',
              'ulaw_8000',
            ],
          },
          enable_ssml_parsing: {
            type: 'boolean',
            description:
              'When true, the model interprets SSML tags in the input text (e.g., <break time="1s"/> for pauses). Useful if the LLM\'s output will include SSML markup for pacing control. For Lead360\'s current setup, this can remain false unless the system prompt is updated to emit SSML.',
            default: false,
          },
          apply_text_normalization: {
            type: 'string',
            description:
              'Controls how the model handles numbers, currency, dates, and abbreviations when converting to speech. ',
            default: 'on',
            enum: ['auto', 'on', 'off'],
          },
          inactivity_timeout: {
            type: 'number',
            description:
              'How many seconds of inactivity before the WebSocket context is closed by ElevenLabs. Measured in seconds. For telephony call sessions, setting this to match expected maximum silence gaps (e.g., 30–60) prevents premature disconnections during longer pauses.',
            default: 20,
            minimum: 20,
            maximum: 180,
          },
          auto_mode: {
            type: 'boolean',
            description:
              'When true, disables internal chunk scheduling and buffering. Recommended when sending complete sentences or phrases rather than streaming token-by-token.',
            default: false,
          },
          enable_logging: {
            type: 'boolean',
            description:
              'When false, Zero Retention Mode is activated — ElevenLabs does not log or store the request. Enterprise-only feature. Same constraint as the STT equivalent.',
            default: true,
          },
          'voice_settings.stability': {
            type: 'number',
            description:
              'Controls how consistent and predictable the voice delivery is between generations.',
            default: 0.5,
            minimum: 0,
            maximum: 1,
          },
          'voice_settings.similarity_boost': {
            type: 'number',
            description:
              'Controls how closely the output adheres to the selected voice\'s original characteristics. Higher values make the voice more recognizably "itself" but add slight computational overhead. The most common setting is stability around 50, similarity around 75, and keeping style at 0. ',
            default: 0.75,
            minimum: 0,
            maximum: 1,
          },
          'voice_settings.style': {
            type: 'number',
            description:
              'Controls emotional expressiveness and style exaggeration. Higher values produce more dramatic, stylized delivery. 0.0 is neutral. More impactful on eleven_multilingual_v2 than on Flash models. For telephony agents: keep at 0.0 unless specifically testing expressive delivery. Higher values can introduce instability.',
            default: 0.2,
            minimum: 0,
            maximum: 1,
          },
          new_property: {
            type: 'string',
          },
        },
        required: ['model_id', 'language_code', 'output_format'],
      }),
    },
    {
      provider_key: 'claudeai',
      provider_type: 'LLM',
      display_name: 'Claude',
      description: 'Claude ai como LLM',
      logo_url: 'https://claude.ai/favicon.ico',
      documentation_url: 'https://claude.ai/documentation',
      capabilities: JSON.stringify(['streaming', 'multi-langual', 'teste']),
      default_config: JSON.stringify({
        model: 'nova-2',
        ponctuate: true,
        interim_results: true,
      }),
      config_schema: JSON.stringify({
        type: 'object',
        properties: {
          model: {
            type: 'string',
            description: 'Descrição de testes',
            default: 'nova-e',
            enum: ['nova-e', 'teste', 'Claude-V5'],
          },
        },
      }),
    },
  ];

  for (const provider of providers) {
    await prisma.voice_ai_provider.upsert({
      where: { provider_key: provider.provider_key },
      update: provider,
      create: provider,
    });
    console.log(
      `Seeded voice_ai_provider: ${provider.provider_key} (${provider.provider_type})`,
    );
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
