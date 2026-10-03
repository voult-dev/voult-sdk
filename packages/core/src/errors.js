import { VoultError } from '@voult/sdk';

/**
 * Normalize SDK and unexpected errors into a stable JSON shape.
 * @param {unknown} err
 */
export function normalizeVoultError(err) {
  if (err instanceof VoultError) {
    const status = err.status ?? 500;
    return {
      error: {
        code: err.code,
        message: err.message,
        status,
        ...(err.field ? { field: err.field } : {}),
        ...(err.fields ? { fields: err.fields } : {}),
      },
    };
  }

  const status = typeof err?.status === 'number' ? err.status : 500;
  return {
    error: {
      code: err?.code || 'INTERNAL_ERROR',
      message: err?.message || 'Internal server error',
      status,
    },
  };
}
