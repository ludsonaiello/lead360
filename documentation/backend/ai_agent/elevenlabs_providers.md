**Lead360 Platform**

**Backend Module Instruction**

ElevenLabs STT & TTS Provider Layer

  -----------------------------------------------------------------------
  **Field**                   **Value**
  --------------------------- -------------------------------------------
  Document Type               Backend Module Instruction

  Feature Scope               Provider Layer Only --- No new NestJS
                              module

  Target Agent                Backend Specialist Agent (Claude Code)

  Stack                       NestJS · TypeScript · ElevenLabs SDK

  Status                      Ready for Development

  Sprint Assignment           Assign per team discretion
  -----------------------------------------------------------------------

**1. Purpose & Scope**

This document instructs the Backend Specialist Agent on what to build,
why it exists, and exactly where it fits within the existing Voice AI
pipeline. No new NestJS module is created. No existing modules are
modified.

**1.1 What This Task Produces**

Two new provider class files only:

-   api/src/modules/voice-ai/agent/providers/elevenlabs-stt.provider.ts

-   api/src/modules/voice-ai/agent/providers/elevenlabs-tts.provider.ts

Plus two minimal factory registrations (one line each) in:

-   api/src/modules/voice-ai/agent/providers/stt-factory.ts

-   api/src/modules/voice-ai/agent/providers/tts-factory.ts

**1.2 What This Task Does NOT Produce**

-   No new NestJS module, controller, or service

-   No database schema changes

-   No migration files

-   No admin API changes

-   No frontend changes

-   No changes to VoiceAgentSession, VoiceAiContextBuilderService, or
    any existing file beyond the four files listed above

  -----------------------------------------------------------------------
  **⚠** STRICT SCOPE BOUNDARY: If you find yourself modifying any file
  not listed in Section 1.1, stop immediately. That action is out of
  scope for this task.

  -----------------------------------------------------------------------

**2. Architecture Context**

Read this section completely before writing a single line of code.
Understanding where these files sit in the pipeline is mandatory.

**2.1 Pipeline Flow**

Every inbound call follows this execution path:

> Caller speaks
>
> → Twilio captures audio (8kHz phone)
>
> → LiveKit resamples (16kHz)
>
> → STT Provider transcribes → text
>
> → GPT-4o-mini (LLM) receives text → generates response
>
> → TTS Provider synthesizes → audio → caller hears

The STT and TTS providers are the only components this task touches.

**2.2 Provider Factory Pattern**

The session (VoiceAgentSession) never instantiates a provider directly.
It calls a factory function that reads the provider_key string from the
resolved context and returns the correct provider instance. The factory
is the only place a new provider is registered.

Current STT factory (stt-factory.ts):

> switch (providerKey) {
>
> case \'deepgram\': return new DeepgramSttProvider();
>
> default: throw new Error(\`Unknown STT provider: \${providerKey}\`);
>
> }

After this task, the factory must handle:

> case \'elevenlabs\': return new ElevenLabsSttProvider();

Current TTS factory (tts-factory.ts):

> switch (providerKey) {
>
> case \'cartesia\': return new CartesiaTtsProvider();
>
> default: throw new Error(\`Unknown TTS provider: \${providerKey}\`);
>
> }

After this task, the factory must handle:

> case \'elevenlabs\': return new ElevenLabsTtsProvider();

**2.3 How Config Reaches the Provider**

Config is NOT hardcoded. It is resolved at runtime by
VoiceAiContextBuilderService and passed into the session as
context.providers.stt.config and context.providers.tts.config
respectively. These are plain Record\<string, unknown\> objects
populated from the voice_ai_provider.default_config and/or the tenant
stt_config_override / tts_config_override fields in the database.

The provider class reads config values from the SttConfig or
StreamingTtsConfig object it receives. It must never hardcode model
names, API endpoints, or behavioral settings.

**2.4 Interface Contracts (Non-Negotiable)**

The ElevenLabs STT provider MUST implement the SttProvider interface
defined in:

> api/src/modules/voice-ai/agent/providers/stt.interface.ts

The ElevenLabs TTS provider MUST implement the StreamingTtsProvider
interface defined in:

> api/src/modules/voice-ai/agent/providers/tts.interface.ts

  -----------------------------------------------------------------------
  **⚠** Read both interface files completely before writing any
  implementation code. Do not assume what the interface looks like. Read
  the actual files.

  -----------------------------------------------------------------------

**3. Required Reading Before Starting**

The agent MUST read the following files from the codebase before writing
any code. This is mandatory, not optional.

  -------------------------------------------------------------------------------------------------------------------------
  **File Path**                                                                 **Why You Must Read It**
  ----------------------------------------------------------------------------- -------------------------------------------
  api/src/modules/voice-ai/agent/providers/stt.interface.ts                     Defines the SttProvider and SttConfig
                                                                                contracts your STT class must implement
                                                                                exactly

  api/src/modules/voice-ai/agent/providers/tts.interface.ts                     Defines the StreamingTtsProvider and
                                                                                StreamingTtsConfig contracts your TTS class
                                                                                must implement exactly

  api/src/modules/voice-ai/agent/providers/stt-factory.ts                       The exact file you will modify ---
                                                                                understand its current switch structure
                                                                                before adding a case

  api/src/modules/voice-ai/agent/providers/tts-factory.ts                       The exact file you will modify --- same
                                                                                reason

  api/src/modules/voice-ai/agent/providers/deepgram-stt.provider.ts             Reference implementation for STT --- study
                                                                                its startTranscription pattern, event
                                                                                wiring, and getUsage

  api/src/modules/voice-ai/agent/providers/cartesia-websocket-tts.provider.ts   Reference implementation for streaming TTS
                                                                                WebSocket --- study connect, streamText,
                                                                                onAudioChunk, cancelContext, disconnect
                                                                                patterns

  api/src/modules/voice-ai/agent/voice-agent.session.ts                         Shows how providers are called from the
                                                                                session --- understand the call sites, do
                                                                                not modify this file
  -------------------------------------------------------------------------------------------------------------------------

**4. Task 1 --- ElevenLabs STT Provider**

**4.1 File to Create**

> api/src/modules/voice-ai/agent/providers/elevenlabs-stt.provider.ts

**4.2 Purpose**

This class connects to the ElevenLabs Scribe v2 Realtime STT API via
WebSocket, streams audio from LiveKit, and emits transcript events back
to the session. It replaces Deepgram for tenants or globally when
provider_key is set to \"elevenlabs\" for the STT slot.

**4.3 Interface It Must Implement**

> SttProvider (from stt.interface.ts)

Method required: startTranscription(config: SttConfig):
Promise\<SttSession\>

**4.4 SttConfig Properties This Provider Uses**

These are the properties from SttConfig that are relevant for
ElevenLabs. The provider reads them from the config object it receives.
It must not read any Deepgram-specific property names.

  -----------------------------------------------------------------------------------
  **SttConfig        **Type**   **ElevenLabs             **Default if Absent**
  Property**                    Equivalent**             
  ------------------ ---------- ------------------------ ----------------------------
  apiKey             string     Authorization header     Required --- throw if
                                value                    missing

  language           string     language_code parameter  \"en\"
                                in WebSocket init        
                                message                  

  model              string     model_id in WebSocket    \"scribe_v2_experimental\"
                                init message             

  sampleRate         number     sample_rate in audio     16000
                                config                   

  punctuate          boolean    disfluencies =           true
                                !punctuate (inverted     
                                logic)                   

  interim_results    boolean    Controls whether partial true
                                transcripts are emitted  
                                to the session           
  -----------------------------------------------------------------------------------

  -----------------------------------------------------------------------
  **⚠** Do NOT read config.endpointing, config.utterance_end_ms, or
  config.vad_events. These are Deepgram-specific properties. ElevenLabs
  uses its own native end-of-turn detection. Reading Deepgram properties
  in the ElevenLabs class is a defect.

  -----------------------------------------------------------------------

**4.5 Behavioral Requirements**

1.  Connect to the ElevenLabs Scribe v2 Realtime WebSocket endpoint
    using the ElevenLabs SDK or direct WebSocket.

2.  Authenticate using config.apiKey. Do not hardcode any API key.

3.  Send the initialization message with model, language, and audio
    format settings derived from config before sending audio.

4.  Implement sendAudio(chunk: Buffer) --- send each audio buffer to the
    WebSocket connection as binary data.

5.  Implement the on(\"transcript\", handler) event --- call
    handler(text, isFinal) for each transcript event received. Respect
    config.interim_results: if false, only call handler when isFinal is
    true.

6.  Implement the on(\"error\", handler) event --- wire ElevenLabs
    WebSocket error events to the session error handler.

7.  Implement close() --- cleanly terminate the WebSocket connection.

8.  Implement getUsage() --- return { totalSeconds } calculated as
    elapsed wall-clock seconds from session start to close, matching the
    same pattern as DeepgramSttProvider.

9.  Log the configuration being used at session start (model, language,
    sampleRate) --- match the logging style of DeepgramSttProvider.

10. Never log the API key. Never store it on the class instance beyond
    what the connection requires.

**4.6 ElevenLabs SDK**

ElevenLabs publishes an official Node.js SDK. Use it if it provides a
stable WebSocket streaming interface. If the SDK does not expose the
Scribe v2 Realtime WebSocket API, implement using the ws package
directly (already available in the project --- see
cartesia-websocket-tts.provider.ts for precedent). Do not install
packages that are already available.

Install the ElevenLabs SDK if not already present:

> npm install elevenlabs

Verify the package provides a Scribe v2 Realtime streaming client before
using it. If the SDK only supports batch transcription (non-realtime),
use ws directly.

**4.7 Error Handling Rules**

-   If config.apiKey is missing or empty: throw an Error before
    attempting any connection

-   If the WebSocket connection fails: emit the error event with the
    underlying error --- do not swallow

-   If ElevenLabs returns a non-101 status code on WebSocket upgrade:
    emit error event with a clear message including the status code

-   If an audio chunk arrives before the connection is open: queue it or
    drop it with a warn log --- do not throw

**5. Task 2 --- ElevenLabs TTS Provider**

**5.1 File to Create**

> api/src/modules/voice-ai/agent/providers/elevenlabs-tts.provider.ts

**5.2 Purpose**

This class connects to the ElevenLabs Flash v2.5 or Multilingual v2/v3
TTS streaming API, accepts text chunks from the session as the LLM
generates them, and emits audio chunks back to the session for playback
via LiveKit. It replaces Cartesia for tenants or globally when
provider_key is set to \"elevenlabs\" for the TTS slot.

**5.3 Interface It Must Implement**

> StreamingTtsProvider (from tts.interface.ts)

Methods required: connect, streamText, onAudioChunk, cancelContext,
disconnect, isConnected, getUsage

**5.4 StreamingTtsConfig Properties This Provider Uses**

  ----------------------------------------------------------------------------------
  **StreamingTtsConfig   **Type**   **ElevenLabs             **Default if Absent**
  Property**                        Equivalent**             
  ---------------------- ---------- ------------------------ -----------------------
  apiKey                 string     xi-api-key header        Required --- throw if
                                                             missing

  voiceId                string     voice_id in API path or  Required --- throw if
                                    request body             missing

  model                  string     model_id in TTS request  \"eleven_flash_v2_5\"

  language               string     language_code in request \"en\"
                                    (multilingual models)    

  sampleRate             number     output_format sample     16000
                                    rate                     

  encoding               string     output_format encoding   \"pcm_s16le\"
  ----------------------------------------------------------------------------------

**5.5 Model Selection Logic**

ElevenLabs TTS model names differ from Cartesia. The provider must
handle the model field from config correctly.

  ------------------------------------------------------------------------------
  **config.model value**   **ElevenLabs Model       **Notes**
                           Used**                   
  ------------------------ ------------------------ ----------------------------
  eleven_flash_v2_5        eleven_flash_v2_5        Lowest latency (\~75ms),
                                                    English + 32 languages

  eleven_multilingual_v2   eleven_multilingual_v2   High quality, 29 languages

  eleven_multilingual_v3   eleven_multilingual_v3   Newest multilingual model

  Not set / null           eleven_flash_v2_5        Default --- lowest latency
                                                    for telephony
  ------------------------------------------------------------------------------

**5.6 Output Format Requirements**

The audio output from the TTS provider must match what LiveKit expects
for playback. These requirements are non-negotiable:

-   Container: raw PCM (no container headers)

-   Encoding: pcm_s16le (16-bit signed little-endian) --- read from
    config.encoding with this as default

-   Sample Rate: 16000 Hz --- read from config.sampleRate with 16000 as
    default

-   Channels: 1 (mono)

The existing Cartesia WebSocket provider uses the same format. Study it
for the output format pattern.

**5.7 Behavioral Requirements**

11. Implement connect(config: StreamingTtsConfig): establish a
    persistent WebSocket connection to the ElevenLabs streaming TTS
    endpoint. Store config on the instance for use in subsequent calls.

12. Implement streamText(text, contextId, isFinal): send a text chunk to
    ElevenLabs for synthesis. contextId maps to ElevenLabs request
    context tracking. isFinal signals the end of an utterance so
    ElevenLabs can flush remaining audio.

13. Implement onAudioChunk(callback): register the callback that the
    session uses to receive audio. When ElevenLabs sends audio data over
    the WebSocket, call callback(contextId, audioBuffer, isDone).

14. Implement cancelContext(contextId): send a cancellation signal to
    ElevenLabs for the given context --- used during barge-in when the
    caller interrupts the agent.

15. Implement disconnect(): close the WebSocket connection cleanly.
    Clear the audio callback. Do not reset the totalCharactersSent
    counter --- the session reads it after disconnect for usage
    reporting.

16. Implement isConnected(): return true only if the WebSocket is open.

17. Implement getUsage(): return { totalCharacters } --- the running
    total of all characters sent to TTS during this session.

18. Implement token buffering: do not send trivially short or
    punctuation-only strings to ElevenLabs. Buffer tokens until there is
    meaningful content. Study the CartesiaWebSocketTtsProvider for the
    existing buffering pattern.

19. Implement reconnection handling on WebSocket disconnect: attempt up
    to 3 reconnects with a queue of unsent messages, matching the
    maxReconnectAttempts pattern in CartesiaWebSocketTtsProvider.

20. Log provider initialization, connection status, and disconnection.
    Never log the API key. Never log voiceId in production-sensitive
    detail.

**5.8 ElevenLabs TTS WebSocket API**

ElevenLabs provides a WebSocket endpoint for streaming text-to-speech.
The URL pattern is:

> wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id={model}

Authentication is via the xi-api-key query parameter or header. Review
the ElevenLabs SDK and official documentation to confirm the current
WebSocket protocol before implementing. If the SDK provides a stable
WebSocket streaming client, use it. If not, use ws directly.

  -----------------------------------------------------------------------
  **⚠** The ElevenLabs WebSocket TTS protocol may differ from Cartesia\'s
  in message structure. Do not assume the message format. Read the
  ElevenLabs documentation and/or SDK source before writing the message
  builder.

  -----------------------------------------------------------------------

**6. Task 3 --- Factory Registration**

**6.1 stt-factory.ts**

Add one case to the existing switch statement. Do not modify any other
line in this file.

Add after the existing \"deepgram\" case:

> case \'elevenlabs\':
>
> return new ElevenLabsSttProvider();

Add the import at the top of the file:

> import { ElevenLabsSttProvider } from \'./elevenlabs-stt.provider\';

**6.2 tts-factory.ts**

Add one case to the existing switch statement. Do not modify any other
line in this file.

Add after the existing \"cartesia\" case:

> case \'elevenlabs\':
>
> return new ElevenLabsTtsProvider();

Add the import at the top of the file:

> import { ElevenLabsTtsProvider } from \'./elevenlabs-tts.provider\';

  -----------------------------------------------------------------------
  **⚠** The tts-factory.ts currently returns CartesiaTtsProvider
  (HTTP-based, not WebSocket). The ElevenLabs TTS is WebSocket-based and
  implements StreamingTtsProvider. The session calls createTtsProvider()
  but then uses the result as a StreamingTtsProvider. Verify the factory
  return type handles this correctly. If the existing factory signature
  only returns TtsProvider (not StreamingTtsProvider), this is an
  existing issue in the codebase --- flag it as a finding and do not
  break the existing Cartesia behavior.

  -----------------------------------------------------------------------

**7. Task 4 --- Database Provider Records**

Two records must be inserted into the voice_ai_provider table after the
code is deployed. This is a data task, not a code task. It is performed
via the existing admin API or database seed --- not by modifying Prisma
schema or migrations.

**7.1 ElevenLabs STT Provider Record**

  -------------------------------------------------------------------------------------------------
  **Field**             **Value**
  --------------------- ---------------------------------------------------------------------------
  provider_key          elevenlabs

  provider_type         STT

  display_name          ElevenLabs Scribe v2

  description           ElevenLabs Scribe v2 Realtime --- multilingual streaming STT with native
                        end-of-turn detection

  documentation_url     https://elevenlabs.io/docs/api-reference/speech-to-text

  capabilities          \[\"streaming\",\"multilingual\",\"realtime\",\"end-of-turn-detection\"\]

  is_active             true

  config_schema         (see Section 7.3)

  default_config        (see Section 7.3)
  -------------------------------------------------------------------------------------------------

**7.2 ElevenLabs TTS Provider Record**

  ----------------------------------------------------------------------------------------
  **Field**             **Value**
  --------------------- ------------------------------------------------------------------
  provider_key          elevenlabs

  provider_type         TTS

  display_name          ElevenLabs Flash v2.5

  description           ElevenLabs Flash v2.5 --- ultra-low latency streaming TTS
                        (\~75ms), 32+ languages

  documentation_url     https://elevenlabs.io/docs/api-reference/text-to-speech

  capabilities          \[\"streaming\",\"multilingual\",\"websocket\",\"low-latency\"\]

  is_active             true

  config_schema         (see Section 7.4)

  default_config        (see Section 7.4)
  ----------------------------------------------------------------------------------------

**7.3 STT config_schema and default_config**

config_schema (store as JSON string):

> {\"type\":\"object\",\"properties\":{
>
> \"model\":{\"type\":\"string\",\"enum\":\[\"scribe_v2_experimental\"\],\"title\":\"Model\"},
>
> \"sampleRate\":{\"type\":\"number\",\"enum\":\[16000\],\"title\":\"Sample
> Rate\"},
>
> \"punctuate\":{\"type\":\"boolean\",\"title\":\"Add Punctuation\"},
>
> \"interim_results\":{\"type\":\"boolean\",\"title\":\"Stream Interim
> Results\"}
>
> }}

default_config (store as JSON string):

> {\"model\":\"scribe_v2_experimental\",\"sampleRate\":16000,\"punctuate\":true,\"interim_results\":true}

**7.4 TTS config_schema and default_config**

config_schema (store as JSON string):

> {\"type\":\"object\",\"properties\":{
>
> \"model\":{\"type\":\"string\",\"enum\":\[\"eleven_flash_v2_5\",\"eleven_multilingual_v2\",\"eleven_multilingual_v3\"\],\"title\":\"Model\"},
>
> \"sampleRate\":{\"type\":\"number\",\"enum\":\[16000\],\"title\":\"Sample
> Rate\"},
>
> \"encoding\":{\"type\":\"string\",\"enum\":\[\"pcm_s16le\"\],\"title\":\"Audio
> Encoding\"}
>
> }}

default_config (store as JSON string):

> {\"model\":\"eleven_flash_v2_5\",\"sampleRate\":16000,\"encoding\":\"pcm_s16le\"}

**8. Credential Storage**

The ElevenLabs API key is stored via the existing voice_ai_credentials
mechanism. One API key covers both STT and TTS --- ElevenLabs uses a
single key per account.

Because STT and TTS are registered as two separate provider records (one
with provider_type STT, one with provider_type TTS), each needs its own
credential record pointing to its respective provider_id. The same API
key value is stored in both --- this is correct and expected.

Storage is performed via the existing admin credential endpoint. No new
endpoint or credential handling is needed.

  -----------------------------------------------------------------------
  **⚠** Do not store the API key in any provider class file, environment
  variable, or config_schema. Keys are stored exclusively in the
  voice_ai_credentials table, encrypted at rest.

  -----------------------------------------------------------------------

**9. Testing Requirements**

**9.1 Unit Tests --- STT Provider**

File:
api/src/modules/voice-ai/agent/providers/elevenlabs-stt.provider.spec.ts

-   Test: throws if config.apiKey is missing

-   Test: connects to WebSocket on startTranscription

-   Test: sendAudio forwards buffer to WebSocket

-   Test: transcript event fires handler when isFinal is true

-   Test: transcript event does NOT fire handler when interim_results is
    false and isFinal is false

-   Test: error event propagates WebSocket errors to session

-   Test: close() terminates the WebSocket connection

-   Test: getUsage() returns elapsed seconds

-   Test: does NOT read config.endpointing or config.utterance_end_ms

**9.2 Unit Tests --- TTS Provider**

File:
api/src/modules/voice-ai/agent/providers/elevenlabs-tts.provider.spec.ts

-   Test: throws if config.apiKey is missing on connect()

-   Test: throws if config.voiceId is missing on connect()

-   Test: connect() opens WebSocket

-   Test: streamText() sends message to WebSocket

-   Test: streamText() buffers trivially short tokens before sending

-   Test: onAudioChunk callback is fired when audio data arrives

-   Test: cancelContext() sends cancellation message

-   Test: disconnect() closes WebSocket and clears callback

-   Test: isConnected() returns false after disconnect

-   Test: getUsage() returns correct character count

-   Test: reconnection is attempted on unexpected disconnect (up to 3
    times)

**9.3 Factory Tests**

-   Test: createSttProvider(\'elevenlabs\') returns
    ElevenLabsSttProvider instance

-   Test: createSttProvider(\'elevenlabs\') does not throw

-   Test: createTtsProvider(\'elevenlabs\') returns
    ElevenLabsTtsProvider instance

-   Test: createTtsProvider(\'elevenlabs\') does not throw

-   Test: createSttProvider(\'deepgram\') still returns
    DeepgramSttProvider (regression)

-   Test: createTtsProvider(\'cartesia\') still returns
    CartesiaTtsProvider (regression)

**10. Acceptance Criteria**

This task is complete when ALL of the following are true:

  ------------------------------------------------------------------------------
  **\#**   **Criterion**                                   **Verified By**
  -------- ----------------------------------------------- ---------------------
  1        elevenlabs-stt.provider.ts exists and           tsc \--noEmit passes
           implements SttProvider interface without        
           TypeScript errors                               

  2        elevenlabs-tts.provider.ts exists and           tsc \--noEmit passes
           implements StreamingTtsProvider interface       
           without TypeScript errors                       

  3        stt-factory.ts handles provider_key             Unit test
           \"elevenlabs\" without throwing                 

  4        tts-factory.ts handles provider_key             Unit test
           \"elevenlabs\" without throwing                 

  5        All existing provider registrations (deepgram,  Regression unit tests
           cartesia) still function --- no regression      

  6        STT provider does not read or use endpointing,  Code review + unit
           utterance_end_ms, or vad_events                 test

  7        TTS provider defaults model to                  Unit test
           eleven_flash_v2_5 when config.model is absent   

  8        Both providers never log the API key            Code review

  9        All unit tests pass                             npm test

  10       No files outside the four listed in Section 1.1 Git diff review
           are modified                                    

  11       ElevenLabs SDK installed and listed in          package.json
           package.json dependencies                       

  12       Database provider records documented and        Manual verification
           insertable via admin API                        post-deploy
  ------------------------------------------------------------------------------

**11. Risks & Open Questions**

**11.1 Risks**

  ------------------------------------------------------------------------------------------
  **Risk**               **Impact**   **Likelihood**   **Mitigation**
  ---------------------- ------------ ---------------- -------------------------------------
  ElevenLabs SDK does    Medium       Low              Fall back to direct ws implementation
  not expose Scribe v2                                 --- precedent exists in
  Realtime WebSocket                                   CartesiaWebSocketTtsProvider
  interface                                            

  ElevenLabs TTS         Medium       Medium           Read ElevenLabs docs before
  WebSocket protocol                                   estimating. If protocol is REST-only
  differs significantly                                streaming (not WebSocket), flag
  from Cartesia ---                                    immediately.
  longer integration                                   
  time than expected                                   

  tts-factory.ts return  Medium       Medium           Inspect factory return type before
  type mismatch between                                adding case. Flag as finding if
  TtsProvider and                                      mismatch exists. Do not fix silently.
  StreamingTtsProvider                                 

  ElevenLabs Scribe v2   Low          Low              Use model: \"scribe_v2_experimental\"
  Realtime is still                                    as the config value --- this is the
  experimental --- API                                 only available model. Monitor
  may change                                           ElevenLabs changelog.
  ------------------------------------------------------------------------------------------

**11.2 Open Questions**

  -----------------------------------------------------------------------
  **Question**              **Why It Matters**        **Who Decides**
  ------------------------- ------------------------- -------------------
  Does the ElevenLabs SDK   Determines implementation Backend Agent
  expose a stable Scribe v2 approach for STT          determines on
  Realtime client, or must  WebSocket                 inspection
  ws be used directly?                                

  Is the ElevenLabs TTS     WebSocket is preferred    Backend Agent flags
  WebSocket endpoint stable for latency, but if       finding; Ludson
  for production use at     unstable it affects call  decides
  Flash v2.5, or is REST    quality                   
  streaming more reliable?                            

  Same provider_key         factory switch uses       Resolved ---
  \"elevenlabs\" for both   provider_key. Both use    confirmed correct
  STT and TTS --- is this   \"elevenlabs\". Confirmed 
  the intended naming       correct per architecture  
  convention?               design.                   
  -----------------------------------------------------------------------

**12. Completion Report Template**

When this task is complete, the Backend Agent must file a completion
report in this format before any other work is started:

> \## Completion Report: ElevenLabs Provider Layer
>
> \### Files Created
>
> \- \[ \] elevenlabs-stt.provider.ts
>
> \- \[ \] elevenlabs-tts.provider.ts
>
> \- \[ \] elevenlabs-stt.provider.spec.ts
>
> \- \[ \] elevenlabs-tts.provider.spec.ts
>
> \### Files Modified
>
> \- \[ \] stt-factory.ts (one line added)
>
> \- \[ \] tts-factory.ts (one line added)
>
> \### SDK
>
> \- Package used: \[elevenlabs npm / direct ws\]
>
> \- Reason: \[why this choice was made\]
>
> \### Findings
>
> \- \[List any discrepancies, surprises, or flags found during
> implementation\]
>
> \### Test Results
>
> \- STT unit tests: \[X passed / Y failed\]
>
> \- TTS unit tests: \[X passed / Y failed\]
>
> \- Factory tests: \[X passed / Y failed\]
>
> \- Regression tests: \[X passed / Y failed\]
>
> \### TypeScript Build
>
> \- tsc \--noEmit: \[PASS / FAIL\]
>
> \### Scope Compliance
>
> \- Files outside Section 1.1 modified: \[YES --- list them / NO\]

Lead360 Platform --- Backend Module Instruction --- ElevenLabs Provider
Layer