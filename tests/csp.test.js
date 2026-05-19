import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function getContentSecurityPolicy() {
  const html = readFileSync(resolve(process.cwd(), 'renderer/index.html'), 'utf8');
  const match = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  return match?.[1] || '';
}

describe('renderer content security policy', () => {
  it('allows MapLibre image source blob and data URLs through the resource pipeline', () => {
    const csp = getContentSecurityPolicy();

    expect(csp).toContain('img-src');
    expect(csp).toContain('img-src \'self\' data: blob: http: https:');
    expect(csp).toContain('connect-src \'self\' data: blob: http: https:');
  });
});
