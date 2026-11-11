import { describe, expect, it } from 'vitest';
import { resolveFileUrl } from './file-url';

// Test API base: http://api.test/api/v1 (vite.config.ts) — a different origin than the jsdom page.
describe('resolveFileUrl', () => {
  it('resolves an API-relative file path against the API origin, not the page origin', () => {
    expect(resolveFileUrl('/files/menu/plov.jpg')).toBe('http://api.test/files/menu/plov.jpg');
    expect(resolveFileUrl('/files/menu/plov.jpg')).not.toContain(window.location.host);
  });

  it('accepts a path without the leading slash', () => {
    expect(resolveFileUrl('files/menu/plov.jpg')).toBe('http://api.test/files/menu/plov.jpg');
  });

  it('keeps the query string of a relative path', () => {
    expect(resolveFileUrl('/files/menu/plov.jpg?v=3')).toBe('http://api.test/files/menu/plov.jpg?v=3');
  });

  it.each([
    'https://cdn.example.com/menu/plov.jpg',
    'http://storage.local:9000/bucket/plov.jpg',
    '//cdn.example.com/menu/plov.jpg',
    'blob:http://localhost:3000/6f1c2b9e-0000-4000-8000-000000000000',
    'data:image/png;base64,iVBORw0KGgo=',
  ])('passes the absolute URL %s through unchanged', (url) => {
    expect(resolveFileUrl(url)).toBe(url);
  });

  it.each([null, undefined, ''])('returns null for %s', (value) => {
    expect(resolveFileUrl(value)).toBeNull();
  });
});
