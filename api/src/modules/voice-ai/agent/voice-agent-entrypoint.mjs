/**
 * ESM Wrapper for Voice Agent Entrypoint
 *
 * This file serves as an ESM-compatible loader for the LiveKit AgentServer.
 * LiveKit requires an ESM module with a default export function.
 *
 * Background:
 * - Our NestJS app uses TypeScript with `module: "nodenext"` which compiles to CommonJS
 * - LiveKit Agents is an ESM package that uses dynamic `import()` to load agent files
 * - When ESM imports a CommonJS module, the default export becomes wrapped in an object
 * - LiveKit expects `module.default` to be a function, but gets an object instead
 *
 * Solution:
 * - This ESM wrapper correctly imports the CommonJS module
 * - Extracts the actual function from the CommonJS exports
 * - Re-exports it as a proper ESM default export that LiveKit can use
 *
 * Architecture:
 * - LiveKit AgentServer loads THIS file (ESM)
 * - This file imports the compiled CommonJS module
 * - Bridges the module system gap transparently
 */

import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the compiled CommonJS module
// This .mjs file is in src/modules/voice-ai/agent/, compiled file is in dist/src/modules/voice-ai/agent/
// From: /var/www/lead360.app/api/src/modules/voice-ai/agent/
// To:   /var/www/lead360.app/api/dist/src/modules/voice-ai/agent/
const compiledModulePath = join(__dirname, '../../../../dist/src/modules/voice-ai/agent/voice-agent-entrypoint.js');

// Validate the compiled file exists
if (!existsSync(compiledModulePath)) {
  throw new Error(
    `[ESM Wrapper] Compiled module not found at: ${compiledModulePath}\n` +
    `Make sure you've run 'npm run build' to compile the TypeScript code.`
  );
}

console.log('[ESM Wrapper] Loading voice agent entrypoint from:', compiledModulePath);

// Import the compiled CommonJS module using ESM dynamic import
const entrypointModule = await import(pathToFileURL(compiledModulePath).href);

// Extract from the CommonJS exports
// TypeScript's "export default X" compiles to CommonJS exports.default = X
// When ESM imports this, it becomes module.default.default (nested)
let agentOrFunction = entrypointModule.default;

// If default is an object with a default property, unwrap it (nested default)
if (typeof agentOrFunction === 'object' && agentOrFunction?.default) {
  agentOrFunction = agentOrFunction.default;
}

// Validate that we got either an Agent object or a function
const isValidAgent =
  typeof agentOrFunction === 'object' &&
  agentOrFunction !== null &&
  'entry' in agentOrFunction &&
  typeof agentOrFunction.entry === 'function';

const isFunction = typeof agentOrFunction === 'function';

if (!isValidAgent && !isFunction) {
  throw new Error(
    `[ESM Wrapper] Failed to load voice agent entrypoint: ` +
    `Expected Agent object with entry function or plain function, ` +
    `got ${typeof agentOrFunction}. ` +
    `Module keys: ${Object.keys(entrypointModule).join(', ')}`
  );
}

if (isValidAgent) {
  console.log('[ESM Wrapper] Successfully loaded Agent object with entry function');
} else {
  console.log('[ESM Wrapper] Successfully loaded plain function (will be wrapped by LiveKit)');
}

// Re-export as proper ESM default export
export default agentOrFunction;
