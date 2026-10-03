// Express req/res ↔ Fetch API Request/Response, so the router itself lives in @voult/core.

const MAX_BODY_BYTES = 100 * 1024; // express.json()'s default limit

function tooLarge() {
  return Object.assign(new Error('Request body is too large'), { status: 413, code: 'PAYLOAD_TOO_LARGE' });
}

/** @param {import('express').Request} req */
async function readBody(req) {
  // Already parsed by the app (express.json(), express.urlencoded()): send it on as JSON.
  if (req.body !== undefined) {
    return { body: JSON.stringify(req.body ?? {}), contentType: 'application/json' };
  }
  if (req.readableEnded) return { body: undefined };

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw tooLarge();
    chunks.push(chunk);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  // The stream is gone now: leave the parsed JSON on req.body, as express.json() did, for
  // the app's own routes behind the router.
  if (body && /\bjson\b/i.test(req.headers['content-type'] ?? '')) {
    try {
      req.body = JSON.parse(body.toString('utf8'));
    } catch {
      // The router answers invalid JSON itself.
    }
  }
  return { body };
}

/**
 * The public URL as Express sees it: `req.protocol` honours `app.set('trust proxy', …)`,
 * which is what the OAuth callback URL is built from.
 * @param {import('express').Request} req
 * @returns {Promise<Request>}
 */
export async function toRequest(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
    else if (value !== undefined) headers.set(name, value);
  }

  const url = `${req.protocol}://${req.get('host') ?? 'localhost'}${req.originalUrl}`;
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Request(url, { method: req.method, headers });
  }

  const { body, contentType } = await readBody(req);
  if (contentType) headers.set('content-type', contentType);
  return new Request(url, { method: req.method, headers, body });
}

/**
 * @param {import('express').Response} res
 * @param {Response} response
 */
export async function writeResponse(res, response) {
  res.statusCode = response.status;
  for (const [name, value] of response.headers) {
    if (name !== 'set-cookie') res.setHeader(name, value);
  }
  for (const cookie of response.headers.getSetCookie()) res.append('Set-Cookie', cookie);
  res.end(Buffer.from(await response.arrayBuffer()));
}
