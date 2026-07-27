-- Sprint 5: Update STT default configuration to reduce interruptions
-- Changes endpointing from 500ms to 800ms and utterance_end_ms from 1500ms to 2000ms
-- This allows for natural pauses in speech without the agent interrupting

UPDATE voice_ai_global_config
SET default_stt_config = JSON_SET(
  COALESCE(default_stt_config, '{}'),
  '$.model', 'nova-2-phonecall',
  '$.endpointing', 800,
  '$.utterance_end_ms', 2000,
  '$.vad_events', true,
  '$.interim_results', true,
  '$.punctuate', true,
  '$.smart_format', true
)
WHERE id = 'default';

-- Verify the update
SELECT 
  id,
  default_stt_config,
  updated_at
FROM voice_ai_global_config
WHERE id = 'default';
