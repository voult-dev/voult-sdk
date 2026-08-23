/**
 * Normalize Voult API error payloads into a consistent shape.
 */

function asString(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function firstString(...values) {
  for (const value of values) {
    const text = asString(value);
    if (text) {
      return text;
    }
  }
  return null;
}

/**
 * Extract field-level validation errors when present.
 * @param {Object} data
 * @returns {Array<{ field: string, message: string }>|undefined}
 */
export function extractValidationFields(data) {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const candidates = [data.errors, data.details?.errors, data.error?.errors, data.validationErrors];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) {
      continue;
    }

    const fields = candidate
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const field = firstString(entry.field, entry.path, entry.param, entry.name);
        const message = firstString(entry.message, entry.msg, entry.error);

        if (!field || !message) {
          return null;
        }

        return { field, message };
      })
      .filter(Boolean);

    if (fields.length > 0) {
      return fields;
    }
  }

  const singleField = firstString(data.field, data.error?.field, data.details?.field);
  const singleMessage = firstString(data.message, data.error?.message);

  if (singleField && singleMessage) {
    return [{ field: singleField, message: singleMessage }];
  }

  return undefined;
}

/**
 * Parse an API error response body into SDK-friendly metadata.
 * Supports flat and nested Voult API formats.
 *
 * @param {unknown} data - Response body
 * @param {number} [status] - HTTP status code
 * @returns {{
 *   apiCode: string,
 *   message: string,
 *   status: number|null,
 *   response: unknown,
 *   fields?: Array<{ field: string, message: string }>
 * }}
 */
export function parseApiErrorResponse(data, status = null) {
  if (!data || typeof data !== 'object') {
    return {
      apiCode: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      status,
      response: data,
    };
  }

  const fields = extractValidationFields(data);
  const nestedError = data.error && typeof data.error === 'object' ? data.error : null;

  if (nestedError) {
    const apiCode = firstString(nestedError.code, data.code) || 'UNKNOWN_ERROR';
    const message =
      firstString(nestedError.message, data.message) ||
      formatFallbackMessage(apiCode, status, fields);

    return {
      apiCode,
      message,
      status: nestedError.status ?? status,
      response: data,
      ...(fields ? { fields } : {}),
    };
  }

  if (typeof data.error === 'string') {
    const apiCode = firstString(data.code, data.error) || 'UNKNOWN_ERROR';
    const message =
      firstString(data.message) ||
      formatFallbackMessage(apiCode, status, fields);

    return {
      apiCode,
      message,
      status,
      response: data,
      ...(fields ? { fields } : {}),
    };
  }

  const apiCode = firstString(data.code) || 'UNKNOWN_ERROR';
  const message =
    firstString(data.message, typeof data.error === 'string' ? data.error : null) ||
    formatFallbackMessage(apiCode, status, fields);

  return {
    apiCode,
    message,
    status,
    response: data,
    ...(fields ? { fields } : {}),
  };
}

/**
 * Build request metadata useful for debugging failed calls.
 * @param {import('axios').AxiosError['config']} config
 * @returns {{ method: string, url: string, baseURL?: string }|undefined}
 */
export function buildRequestContext(config) {
  if (!config) {
    return undefined;
  }

  const method = (config.method || 'get').toUpperCase();
  const url = config.url || '';
  const baseURL = config.baseURL;

  return baseURL ? { method, url, baseURL } : { method, url };
}

function formatFallbackMessage(apiCode, status, fields) {
  if (fields?.length) {
    const summary = fields.map(({ field, message }) => `${field}: ${message}`).join('; ');
    return `Validation failed (${summary})`;
  }

  if (apiCode && apiCode !== 'UNKNOWN_ERROR') {
    return status ? `${apiCode} (HTTP ${status})` : apiCode;
  }

  return status ? `Request failed with HTTP ${status}` : 'An unexpected error occurred';
}
