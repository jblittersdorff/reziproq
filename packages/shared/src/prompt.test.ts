import { describe, expect, it } from 'vitest';
import { promptEventSchema, promptRequestSchema } from './prompt.js';

describe('promptRequestSchema', () => {
  it('akzeptiert einen Verlauf, der mit einer Frage endet', () => {
    expect(
      promptRequestSchema.safeParse({
        messages: [
          { role: 'user', content: 'Öffne das Portfolio' },
          { role: 'assistant', content: 'Ich öffne das Portfolio.' },
          { role: 'user', content: 'Und jetzt die Lieferanten' },
        ],
      }).success,
    ).toBe(true);
  });

  it('lehnt leere, zu lange oder unfertige Verläufe ab', () => {
    const ask = (content: string) => ({ role: 'user' as const, content });
    expect(promptRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(promptRequestSchema.safeParse({ messages: [ask('  ')] }).success).toBe(false);
    expect(promptRequestSchema.safeParse({ messages: [ask('x'.repeat(2001))] }).success).toBe(
      false,
    );
    expect(
      promptRequestSchema.safeParse({ messages: Array.from({ length: 21 }, () => ask('Hallo')) })
        .success,
    ).toBe(false);
    expect(
      promptRequestSchema.safeParse({
        messages: [ask('Hallo'), { role: 'assistant', content: 'Hallo!' }],
      }).success,
    ).toBe(false);
  });
});

describe('promptEventSchema', () => {
  it('erlaubt feste Bereiche und Lieferanten-Spend-Ziele, aber keine freien Routen', () => {
    expect(
      promptEventSchema.safeParse({
        type: 'navigate',
        destination: { type: 'area', path: '/portfolio' },
      }).success,
    ).toBe(true);
    expect(
      promptEventSchema.safeParse({
        type: 'navigate',
        destination: {
          type: 'supplierSpend',
          relationshipId: '00000000-0000-4000-8000-000000000001',
        },
      }).success,
    ).toBe(true);
    expect(
      promptEventSchema.safeParse({
        type: 'navigate',
        destination: { type: 'area', path: '/admin' },
      }).success,
    ).toBe(false);
    expect(
      promptEventSchema.safeParse({
        type: 'navigate',
        destination: { type: 'supplierSpend', relationshipId: '../admin' },
      }).success,
    ).toBe(false);
  });
});
