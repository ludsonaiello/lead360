-- Voice AI Conversational UX Improvements
-- Sprint: Voice-UX-01
-- Date: 2026-02-27
--
-- Adds configurable conversational phrases to voice_ai_global_config
-- for improved user experience during voice agent interactions.
--
-- Phrase categories:
-- - recovery_messages: When STT fails or gets empty/noisy input
-- - filler_phrases: Spoken before tool execution ("Let me check that...")
-- - long_wait_messages: Spoken during long tool execution (>20s)
-- - system_error_messages: Generic system errors (DB, API failures)

ALTER TABLE voice_ai_global_config
ADD COLUMN recovery_messages JSON DEFAULT '["Sorry, I didn''t quite catch that. Could you repeat?", "I missed that. What did you say?", "Could you say that again, please?"]',
ADD COLUMN filler_phrases JSON DEFAULT '["Let me check that for you.", "One moment while I look that up.", "Alright, I''ll check the information. Hold on."]',
ADD COLUMN long_wait_messages JSON DEFAULT '["Still checking, just a moment...", "This is taking a bit longer, almost there...", "I''m still working on it, one moment please..."]',
ADD COLUMN system_error_messages JSON DEFAULT '["I''m having some trouble right now. Could you try again?", "Something''s not working on my end. Please try again."]';
