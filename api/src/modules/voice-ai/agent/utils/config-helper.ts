/**
 * Config Helper Utilities
 *
 * Provides dynamic configuration field access for Voice AI providers.
 * Enables providers to work with ANY custom fields defined in their schemas
 * without hardcoding specific field names.
 *
 * Core Principle: The provider's config_schema is the source of truth.
 * Providers should NOT assume specific field names exist.
 */

/**
 * Get a configuration field value with dynamic field name resolution.
 *
 * Tries multiple possible field names in priority order and returns
 * the first non-null/non-undefined value found.
 *
 * Supports nested field access using dot notation (e.g., 'voice_settings.stability').
 *
 * @param config The configuration object (from context.providers.*)
 * @param possibleNames Array of field names to try (in priority order)
 * @param defaultValue Fallback value if none of the fields exist
 * @returns The found value or defaultValue
 *
 * @example
 * // Try 'model_id' first, then 'model', fallback to 'gpt-4o'
 * const model = getConfigField(config, ['model_id', 'model', 'tts_model'], 'gpt-4o');
 *
 * @example
 * // Nested field access
 * const stability = getConfigField(config, ['voice_settings.stability', 'stability'], 0.5);
 */
export function getConfigField<T = any>(
  config: Record<string, any>,
  possibleNames: string[],
  defaultValue: T,
): T;
export function getConfigField<T = any>(
  config: Record<string, any>,
  possibleNames: string[],
): T | undefined;
export function getConfigField<T = any>(
  config: Record<string, any>,
  possibleNames: string[],
  defaultValue?: T,
): T | undefined {
  for (const name of possibleNames) {
    // Support nested field access (e.g., 'voice_settings.stability')
    if (name.includes('.')) {
      const value = getNestedField(config, name);
      if (value !== undefined && value !== null) {
        return value as T;
      }
    } else {
      // Direct field access
      if (config[name] !== undefined && config[name] !== null) {
        return config[name] as T;
      }
    }
  }

  return defaultValue;
}

/**
 * Get a nested field value using dot notation.
 *
 * @param obj The object to traverse
 * @param path Dot-separated path (e.g., 'voice_settings.stability')
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * const config = { voice_settings: { stability: 0.5 } };
 * const value = getNestedField(config, 'voice_settings.stability'); // 0.5
 */
export function getNestedField(
  obj: Record<string, any>,
  path: string,
): any | undefined {
  const parts = path.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Convert flat config to nested object based on dot notation keys.
 *
 * Some provider schemas may use flat keys with dots (e.g., 'voice_settings.stability')
 * while the provider expects a nested object structure.
 *
 * @param flatConfig Flat configuration object with dot-notation keys
 * @returns Nested configuration object
 *
 * @example
 * const flat = {
 *   model: 'eleven_flash_v2_5',
 *   'voice_settings.stability': 0.5,
 *   'voice_settings.similarity_boost': 0.8
 * };
 *
 * const nested = convertFlatToNested(flat);
 * // Result:
 * // {
 * //   model: 'eleven_flash_v2_5',
 * //   voice_settings: {
 * //     stability: 0.5,
 * //     similarity_boost: 0.8
 * //   }
 * // }
 */
export function convertFlatToNested(
  flatConfig: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(flatConfig)) {
    if (key.includes('.')) {
      // Nested key - split and create nested structure
      const parts = key.split('.');
      let current = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }

      const lastPart = parts[parts.length - 1];
      current[lastPart] = value;
    } else {
      // Direct key
      result[key] = value;
    }
  }

  return result;
}

/**
 * Validate that required fields exist in config.
 *
 * Throws an error if any required field is missing or null/undefined.
 *
 * @param config The configuration object to validate
 * @param requiredFields Array of field names that must exist
 * @param providerName Provider name for error messages
 *
 * @throws Error if required field is missing
 *
 * @example
 * validateRequiredFields(config, ['apiKey', 'voiceId'], 'ElevenLabs TTS');
 */
export function validateRequiredFields(
  config: Record<string, any>,
  requiredFields: string[],
  providerName: string,
): void {
  for (const field of requiredFields) {
    if (config[field] === undefined || config[field] === null) {
      throw new Error(
        `${providerName}: Required field '${field}' is missing or null`,
      );
    }
  }
}
