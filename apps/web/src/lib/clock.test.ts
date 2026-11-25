import { businessTimeHeader } from '@reziproq/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { appNow, noteBusinessTime, resetBusinessTime } from './clock';

// DM-01 (K1-b.4): Nennt die API eine Fachzeit (Demo-Uhr), rechnet die Oberfläche damit; ohne Kopf
// bleibt es bei der Uhr des Browsers.

afterEach(resetBusinessTime);

describe('Fachzeit', () => {
  it('folgt dem Kopf der API und läuft von dort weiter', () => {
    noteBusinessTime(new Headers({ [businessTimeHeader]: '2026-11-23T06:30:00.000Z' }));
    const now = appNow().getTime();
    expect(now - Date.parse('2026-11-23T06:30:00.000Z')).toBeGreaterThanOrEqual(0);
    expect(now - Date.parse('2026-11-23T06:30:00.000Z')).toBeLessThan(5_000);
  });

  it('ohne Kopf oder mit ungültigem Wert bleibt die Uhr, wie sie ist', () => {
    noteBusinessTime(new Headers());
    noteBusinessTime(new Headers({ [businessTimeHeader]: 'kein Datum' }));
    expect(Math.abs(appNow().getTime() - Date.now())).toBeLessThan(5_000);
  });
});
