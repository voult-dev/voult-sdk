/** Error thrown by @voult/react actions: the BFF's normalized `{ error: { code, message, status } }`. */
export class VoultRequestError extends Error {
  constructor({ code, message, status, field, fields }) {
    super(message);
    this.name = 'VoultRequestError';
    this.code = code;
    this.status = status;
    if (field) this.field = field;
    if (fields) this.fields = fields;
  }
}

/**
 * JSON request to the @voult/express BFF. Cookies always go along: the session lives in them.
 * @param {string} apiBase
 * @param {string} path
 * @param {{ method?: string, body?: unknown, fetchImpl: typeof fetch }} options
 */
export async function request(apiBase, path, { method = 'GET', body, fetchImpl }) {
  const res = await fetchImpl(`${apiBase}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body
  }

  if (!res.ok) {
    const error = typeof data?.error === 'object' && data.error ? data.error : {};
    throw new VoultRequestError({
      code: error.code ?? `HTTP_${res.status}`,
      message: error.message ?? (typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`),
      status: res.status,
      field: error.field,
      fields: error.fields,
    });
  }

  return data;
}
