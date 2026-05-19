import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Reads the Content-Security-Policy the Tauri build serves to the renderer. */
function getContentSecurityPolicy() {
  const config = JSON.parse(
    readFileSync(resolve(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8')
  );
  return config.app?.security?.csp || '';
}

describe('tauri content security policy', () => {
  it('allows MapLibre image and connect sources through the resource pipeline', () => {
    const csp = getContentSecurityPolicy();

    expect(csp).toContain('img-src');
    expect(csp).toContain("img-src 'self' data: blob: http: https:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('data: blob: http: https:');
    expect(csp).toContain('worker-src blob:');
  });

  it('restricts script execution to same-origin', () => {
    expect(getContentSecurityPolicy()).toContain("script-src 'self'");
  });

  it('permits the Tauri IPC connect sources', () => {
    expect(getContentSecurityPolicy()).toContain('ipc: http://ipc.localhost');
  });
});
