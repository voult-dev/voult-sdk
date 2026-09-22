import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BASE_URL } from '@voult/sdk';
import { loadConfigFromEnv } from '../src/index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadConfigFromEnv', () => {
  it('reads canonical VOULT_* env names and defaults session strategy to cookie', () => {
    const config = loadConfigFromEnv({
      env: {
        VOULT_BASE_URL: 'https://staging.voult.dev',
        VOULT_CLIENT_ID: 'client-id',
        VOULT_CLIENT_SECRET: 'client-secret',
        VOULT_SESSION_SECRET: 'session-secret',
        VOULT_APP_URL: 'https://app.example.com',
      },
    });

    expect(config).toEqual({
      baseURL: 'https://staging.voult.dev',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      sessionSecret: 'session-secret',
      appUrl: 'https://app.example.com',
      session: { strategy: 'cookie' },
    });
  });

  it('defaults base URL when VOULT_BASE_URL is omitted', () => {
    const config = loadConfigFromEnv({
      env: {
        VOULT_CLIENT_ID: 'client-id',
        VOULT_CLIENT_SECRET: 'client-secret',
      },
    });

    expect(config.baseURL).toBe(DEFAULT_BASE_URL);
  });

  it('applies overrides over env values', () => {
    const config = loadConfigFromEnv({
      env: {
        VOULT_CLIENT_ID: 'env-id',
        VOULT_CLIENT_SECRET: 'env-secret',
      },
      overrides: {
        clientId: 'override-id',
        session: { strategy: 'bearer' },
      },
    });

    expect(config.clientId).toBe('override-id');
    expect(config.clientSecret).toBe('env-secret');
    expect(config.session.strategy).toBe('bearer');
  });

  it('accepts legacy aliases with a one-time deprecation warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = {
      CLIENT_ID: 'legacy-id',
      CLIENT_SECRET: 'legacy-secret',
    };

    const first = loadConfigFromEnv({ env });
    const second = loadConfigFromEnv({ env });

    expect(first.clientId).toBe('legacy-id');
    expect(second.clientSecret).toBe('legacy-secret');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('CLIENT_ID');
    expect(warn.mock.calls[0][0]).toContain('VOULT_CLIENT_ID');
    expect(warn.mock.calls[1][0]).toContain('CLIENT_SECRET');
    expect(warn.mock.calls[1][0]).toContain('VOULT_CLIENT_SECRET');
  });

  it('prefers canonical env names over legacy aliases', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = loadConfigFromEnv({
      env: {
        VOULT_CLIENT_ID: 'canonical-id',
        CLIENT_ID: 'legacy-id',
        VOULT_CLIENT_SECRET: 'canonical-secret',
      },
    });

    expect(config.clientId).toBe('canonical-id');
    expect(warn).not.toHaveBeenCalled();
  });

  it('throws with a dashboard hint when VOULT_CLIENT_ID is missing', () => {
    expect(() =>
      loadConfigFromEnv({
        env: {
          VOULT_CLIENT_SECRET: 'client-secret',
        },
      })
    ).toThrow(/VOULT_CLIENT_ID[\s\S]*dashboard/i);
  });

  it('throws when VOULT_CLIENT_SECRET is missing', () => {
    expect(() =>
      loadConfigFromEnv({
        env: {
          VOULT_CLIENT_ID: 'client-id',
        },
      })
    ).toThrow(/VOULT_CLIENT_SECRET/);
  });

  it('throws when VOULT_BASE_URL is not an http(s) URL', () => {
    expect(() =>
      loadConfigFromEnv({
        env: {
          VOULT_CLIENT_ID: 'client-id',
          VOULT_CLIENT_SECRET: 'client-secret',
          VOULT_BASE_URL: 'not-a-url',
        },
      })
    ).toThrow(/Invalid VOULT_BASE_URL "not-a-url"/);

    expect(() =>
      loadConfigFromEnv({
        env: {
          VOULT_CLIENT_ID: 'client-id',
          VOULT_CLIENT_SECRET: 'client-secret',
          VOULT_BASE_URL: 'ftp://api.voult.dev',
        },
      })
    ).toThrow(/VOULT_BASE_URL/);
  });

  it('throws in production when cookie strategy has no VOULT_SESSION_SECRET', () => {
    expect(() =>
      loadConfigFromEnv({
        env: {
          NODE_ENV: 'production',
          VOULT_CLIENT_ID: 'client-id',
          VOULT_CLIENT_SECRET: 'client-secret',
        },
      })
    ).toThrow(/VOULT_SESSION_SECRET/);
  });

  it('allows cookie strategy without a session secret outside production', () => {
    const config = loadConfigFromEnv({
      env: {
        NODE_ENV: 'test',
        VOULT_CLIENT_ID: 'client-id',
        VOULT_CLIENT_SECRET: 'client-secret',
      },
    });

    expect(config.session.strategy).toBe('cookie');
    expect(config.sessionSecret).toBeUndefined();
  });

  it('allows bearer strategy in production without a session secret', () => {
    const config = loadConfigFromEnv({
      env: {
        NODE_ENV: 'production',
        VOULT_CLIENT_ID: 'client-id',
        VOULT_CLIENT_SECRET: 'client-secret',
      },
      overrides: {
        session: { strategy: 'bearer' },
      },
    });

    expect(config.session.strategy).toBe('bearer');
  });
});
