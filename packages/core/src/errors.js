import { VoultError } from '@voult/sdk';

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * What the browser may see of an error. 4xx are things the user can fix (wrong password, email
 * taken, locked, too many attempts): their message stays, and the code is the Voult API's own
 * (`INVALID_CREDENTIALS`, as in ERRORS.md) when there is one. Everything else (5xx, network,
 * bugs) is logged in full on the server and reaches the browser only as a generic message.
 * @param {unknown} err
 * @param {{ log?: (...args: unknown[]) => void, context?: string }} [options]
 * @returns {{ code: string, message: string, status: number, field?: string, fields?: unknown }}
 */
export function publicError(err, { log = console.error, context = '' } = {}) {
  const isVoult = err instanceof VoultError;
  const status = typeof err?.status === 'number' && err.status >= 400 ? err.status : 500;

  if (status >= 500) {
    log(`[voult]${context ? ` ${context}` : ''} failed:`, err);
    return { code: 'INTERNAL_ERROR', message: GENERIC_ERROR_MESSAGE, status };
  }

  const apiCode = isVoult && err.apiCode && err.apiCode !== 'UNKNOWN_ERROR' ? err.apiCode : undefined;
  return {
    code: apiCode ?? err?.code ?? 'BAD_REQUEST',
    message: err?.message || 'Request failed',
    status,
    ...(err?.field ? { field: err.field } : {}),
    ...(err?.fields ? { fields: err.fields } : {}),
  };
}

/**
 * The JSON body for an error: `{ error: { code, message, status } }` (see publicError).
 * @param {unknown} err
 * @param {{ log?: (...args: unknown[]) => void, context?: string }} [options]
 */
export function normalizeVoultError(err, options) {
  return { error: publicError(err, options) };
}
