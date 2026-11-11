import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveEnv } from './env';

const WEB_ORIGIN = 'https://app.respos.uz';
const DESKTOP_ORIGIN = 'http://127.0.0.1:47615';

describe('resolveEnv', () => {
  it('falls back to the local development defaults', () => {
    expect(resolveEnv({}, WEB_ORIGIN)).toEqual({
      apiBaseUrl: 'http://localhost:5080/api/v1',
      hubUrl: 'http://localhost:5080/hubs/restaurant',
      landingUrl: 'http://localhost:5174',
      appEnv: 'development',
      isProduction: false,
    });
  });

  it('keeps absolute URLs as they are, whatever the page origin (web / Vercel builds)', () => {
    const env = resolveEnv(
      {
        VITE_API_BASE_URL: 'https://api.respos.uz/api/v1/',
        VITE_HUB_URL: 'https://api.respos.uz/hubs/restaurant',
        VITE_LANDING_URL: 'https://respos.uz/',
        VITE_APP_ENV: 'production',
      },
      WEB_ORIGIN,
    );
    expect(env.apiBaseUrl).toBe('https://api.respos.uz/api/v1');
    expect(env.hubUrl).toBe('https://api.respos.uz/hubs/restaurant');
    expect(env.landingUrl).toBe('https://respos.uz');
    expect(env.isProduction).toBe(true);
  });

  it('resolves root-relative API and hub URLs against the page origin (desktop shell gateway)', () => {
    const env = resolveEnv({ VITE_API_BASE_URL: '/api/v1', VITE_HUB_URL: '/hubs/restaurant' }, DESKTOP_ORIGIN);
    expect(env.apiBaseUrl).toBe('http://127.0.0.1:47615/api/v1');
    expect(env.hubUrl).toBe('http://127.0.0.1:47615/hubs/restaurant');
  });

  it('follows the origin the page is actually served from (fallback gateway port)', () => {
    const env = resolveEnv({ VITE_API_BASE_URL: '/api/v1/', VITE_HUB_URL: '/hubs/restaurant' }, 'http://127.0.0.1:50123');
    expect(env.apiBaseUrl).toBe('http://127.0.0.1:50123/api/v1');
    expect(env.hubUrl).toBe('http://127.0.0.1:50123/hubs/restaurant');
  });

  it('treats empty values as not set', () => {
    expect(resolveEnv({ VITE_API_BASE_URL: '', VITE_HUB_URL: '' }, WEB_ORIGIN).apiBaseUrl).toBe('http://localhost:5080/api/v1');
  });

  it.each(['api/v1', '//evil.example/api/v1', 'not a url', 'ftp://api.respos.uz/api/v1', 'C:/Program Files/Git/api/v1'])(
    'rejects "%s" as an API base or hub URL',
    (value) => {
      expect(() => resolveEnv({ VITE_API_BASE_URL: value }, WEB_ORIGIN)).toThrow(/Invalid environment configuration/);
      expect(() => resolveEnv({ VITE_HUB_URL: value }, WEB_ORIGIN)).toThrow(/Invalid environment configuration/);
    },
  );

  it('rejects a relative URL when the page has no http(s) origin', () => {
    expect(() => resolveEnv({ VITE_API_BASE_URL: '/api/v1' }, 'null')).toThrow(/is relative, but the page origin "null"/);
  });

  it('rejects an unknown app environment', () => {
    expect(() => resolveEnv({ VITE_APP_ENV: 'staging' }, WEB_ORIGIN)).toThrow(/Invalid environment configuration/);
  });
});

describe('env built with root-relative URLs (desktop build)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('gives the API client and file URLs absolute, same-origin addresses', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api/v1');
    vi.stubEnv('VITE_HUB_URL', '/hubs/restaurant');
    vi.resetModules();
    const { env } = await import('./env');
    const { buildUrl } = await import('@/shared/api/api-client');
    const { resolveFileUrl } = await import('@/shared/api/file-url');
    const origin = window.location.origin;

    expect(env.apiBaseUrl).toBe(`${origin}/api/v1`);
    expect(env.hubUrl).toBe(`${origin}/hubs/restaurant`);
    expect(buildUrl('/menu/items', { page: 2 })).toBe(`${origin}/api/v1/menu/items?page=2`);
    expect(resolveFileUrl('/files/menu/plov.jpg')).toBe(`${origin}/files/menu/plov.jpg`);
  });
});
