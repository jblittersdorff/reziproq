import { describe, expect, it } from 'vitest';
import { assignConfidence, autoAssignThreshold } from './assign-confidence.js';

// PO-01, E-K2-5 (K2-d.2): Konfidenz der Zuordnung nach festen Regeln; ab 0,9 ordnet Reziproq selbst zu.
describe('Konfidenz der Zuordnung einer Mail (PO-01)', () => {
  const rheintal = ['rheintal.example'];

  it('bekannte Ansprechpartnerin 0,98, nur ihre Domain 0,92, nur Empfänger 0,75', () => {
    expect(
      assignConfidence({
        senderEmail: 'kim@rheintal.example',
        domains: rheintal,
        senderIsContact: true,
      }),
    ).toBe(0.98);
    expect(
      assignConfidence({
        senderEmail: 'Neu@Rheintal.example',
        domains: rheintal,
        senderIsContact: false,
      }),
    ).toBe(0.92);
    expect(
      assignConfidence({
        senderEmail: 'bert@hollmann.example',
        domains: rheintal,
        senderIsContact: false,
      }),
    ).toBe(0.75);
  });

  it('selbst zugeordnet wird erst ab 0,9', () => {
    expect(autoAssignThreshold).toBe(0.9);
    expect(0.92 >= autoAssignThreshold).toBe(true);
    expect(0.75 >= autoAssignThreshold).toBe(false);
  });
});
