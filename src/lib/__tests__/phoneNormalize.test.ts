import { describe, it, expect } from 'vitest';
import { normalizePhoneAR } from '@/lib/phoneNormalize';

describe('normalizePhoneAR', () => {
  it('returns null for empty / nullish input', () => {
    expect(normalizePhoneAR(undefined)).toBeNull();
    expect(normalizePhoneAR(null)).toBeNull();
    expect(normalizePhoneAR('')).toBeNull();
    expect(normalizePhoneAR('abc')).toBeNull();
  });

  it('strips non-digits and leading zeros', () => {
    expect(normalizePhoneAR('011-4567-8910')).toBe('541145678910');
  });

  it('prefixes country code 54 when missing', () => {
    expect(normalizePhoneAR('1145678910')).toBe('541145678910');
  });

  it('does not duplicate country code when already present', () => {
    expect(normalizePhoneAR('541145678910')).toBe('541145678910');
    expect(normalizePhoneAR('+54 11 4567 8910')).toBe('541145678910');
  });

  it('removes the "15" mobile separator between area code and local number', () => {
    expect(normalizePhoneAR('+54 11 15 3103 4783')).toBe('541131034783');
    expect(normalizePhoneAR('011 15 4567 8910')).toBe('541145678910');
  });

  it('handles 4-digit area codes with 15', () => {
    expect(normalizePhoneAR('+54 2954 15 123456')).toBe('542954123456');
  });

  it('produces same value for equivalent inputs (idempotent dedup signal)', () => {
    const variants = [
      '+54 11 1503 4783',
      '011-15-1503-4783',
      '5411 1503 4783',
      '+5411 15 1503 4783',
    ];
    const normalized = variants.map((v) => normalizePhoneAR(v));
    const first = normalized[0];
    expect(first).not.toBeNull();
    for (const n of normalized) expect(n).toBe(first);
  });
});
