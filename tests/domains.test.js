import { describe, expect, it } from 'vitest';
import domains from '../src/domains';

const { assertValidDomain, isValidDomain } = domains;

describe('domain validation', () => {
  it('accepts supported Cambodia Meteo radar domains', () => {
    expect(isValidDomain('PHN')).toBe(true);
    expect(isValidDomain('240KM')).toBe(true);
    expect(isValidDomain('CAMBODIA')).toBe(true);
  });

  it('rejects arbitrary values and URLs', () => {
    expect(isValidDomain('')).toBe(false);
    expect(isValidDomain('http://example.com')).toBe(false);
    expect(isValidDomain('../PHN')).toBe(false);
    expect(() => assertValidDomain('http://example.com')).toThrow(/Invalid radar domain/);
  });
});
