// Cookies in exactly the format Express + cookie-parser use (so sessions survive the switch
// between adapters), built on WebCrypto so the same code runs on Node and the Edge.
//   signed value: `s:<value>.<base64 HMAC-SHA256(value), padding stripped>` (cookie-signature)
//   Set-Cookie:   `name=<encoded>; Max-Age=; Path=; Expires=; HttpOnly; Secure; SameSite=`

const encoder = new TextEncoder();
const hmacKeys = new Map();

function hmacKey(secret) {
  if (!hmacKeys.has(secret)) {
    hmacKeys.set(
      secret,
      globalThis.crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    );
  }
  return hmacKeys.get(secret);
}

export function base64(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** cookie-signature `sign()`: `<value>.<mac>` */
export async function sign(value, secret) {
  const mac = await globalThis.crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(value));
  return `${value}.${base64(mac).replace(/=+$/, '')}`;
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** cookie-signature `unsign()`: the value, or `false` when the signature is wrong. */
export async function unsign(signed, secret) {
  const dot = signed.lastIndexOf('.');
  if (dot < 0) return false;
  const value = signed.slice(0, dot);
  return safeEqual(await sign(value, secret), signed) ? value : false;
}

function decode(value) {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Parse a `Cookie` header like the `cookie` package: first occurrence wins, quotes stripped. */
export function parseCookieHeader(header) {
  const cookies = Object.create(null);
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || Object.hasOwn(cookies, name)) continue;
    let value = part.slice(eq + 1).trim();
    if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    cookies[name] = decode(value);
  }
  return cookies;
}

/**
 * cookie-parser semantics: with a secret, `s:` values move to `signedCookies` (`false` when
 * tampered with); everything else stays in `cookies`.
 */
export async function readCookieHeader(header, secret) {
  const cookies = parseCookieHeader(header);
  const signedCookies = Object.create(null);
  if (secret) {
    for (const [name, value] of Object.entries(cookies)) {
      if (!value.startsWith('s:')) continue;
      signedCookies[name] = await unsign(value.slice(2), secret);
      delete cookies[name];
    }
  }
  return { cookies, signedCookies };
}

/** Express `res.cookie()` output for an already-signed value. `maxAge` is in milliseconds. */
export function serializeCookie(name, value, options = {}) {
  let str = `${name}=${encodeURIComponent(value)}`;
  let { expires } = options;
  if (options.maxAge != null) {
    expires = new Date(Date.now() + options.maxAge);
    str += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
  }
  str += `; Path=${options.path ?? '/'}`;
  if (expires) str += `; Expires=${expires.toUTCString()}`;
  if (options.httpOnly) str += '; HttpOnly';
  if (options.secure) str += '; Secure';
  if (options.sameSite) str += `; SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1).toLowerCase()}`;
  return str;
}

/** A Set-Cookie header for a `{ name, value, options }` cookie, signing it when `options.signed`. */
export async function setCookieHeader({ name, value, options }, secret) {
  const final = options.signed ? `s:${await sign(value, secret)}` : value;
  return serializeCookie(name, final, options);
}
