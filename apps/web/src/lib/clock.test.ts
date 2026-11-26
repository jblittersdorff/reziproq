// @vitest-environment jsdom
import { businessTimeHeader } from '@reziproq/shared';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appNow,
  businessTimeKey,
  noteBusinessTime,
  resetBusinessTime,
  startBusinessTime,
} from './clock';

// DM-01 (K1-b.4): Nennt die API eine Fachzeit (Demo-Uhr), rechnet die Oberfläche damit; ohne Kopf
// bleibt es bei der Uhr des Browsers. K1-b.5: Der Versatz gilt je Tab und überlebt das Neuladen nur
// in einer Demo-Sitzung.

const demoTime = '2026-11-23T06:30:00.000Z';
const day = 86_400_000;
/** Abstand von appNow zu einem Zeitpunkt, in Millisekunden */
const sinceThen = (iso: string) => appNow().getTime() - Date.parse(iso);

afterEach(() => {
  resetBusinessTime();
  window.sessionStorage.clear();
});

describe('Fachzeit', () => {
  it('folgt dem Kopf der API und läuft von dort weiter', () => {
    noteBusinessTime(new Headers({ [businessTimeHeader]: demoTime }));
    expect(sinceThen(demoTime)).toBeGreaterThanOrEqual(0);
    expect(sinceThen(demoTime)).toBeLessThan(5_000);
  });

  it('ohne Kopf oder mit ungültigem Wert bleibt die Uhr, wie sie ist', () => {
    noteBusinessTime(new Headers());
    noteBusinessTime(new Headers({ [businessTimeHeader]: 'kein Datum' }));
    expect(Math.abs(appNow().getTime() - Date.now())).toBeLessThan(5_000);
    expect(window.sessionStorage.getItem(businessTimeKey)).toBeNull();
  });

  it('hält den Versatz im Tab; beim Start einer Demo-Sitzung gilt er schon vor der ersten Antwort', () => {
    noteBusinessTime(new Headers({ [businessTimeHeader]: demoTime }));
    const stored = Number(window.sessionStorage.getItem(businessTimeKey));
    expect(stored).toBeLessThan(-day);
    // Neuladen: Der Speicher bleibt im Tab, der Versatz im Speicher des Moduls nicht
    window.sessionStorage.setItem(businessTimeKey, String(stored));
    startBusinessTime(true);
    expect(sinceThen(demoTime)).toBeGreaterThanOrEqual(0);
    expect(sinceThen(demoTime)).toBeLessThan(5_000);
  });

  it('ohne Demo-Sitzung verwirft der Start einen Versatz, der noch im Tab steht', () => {
    window.sessionStorage.setItem(businessTimeKey, String(-2 * day));
    startBusinessTime(false);
    expect(Math.abs(appNow().getTime() - Date.now())).toBeLessThan(5_000);
    expect(window.sessionStorage.getItem(businessTimeKey)).toBeNull();
  });

  it('ein ungültiger Wert im Tab gilt nicht; zurücksetzen löscht ihn', () => {
    window.sessionStorage.setItem(businessTimeKey, 'gestern');
    startBusinessTime(true);
    expect(Math.abs(appNow().getTime() - Date.now())).toBeLessThan(5_000);
    noteBusinessTime(new Headers({ [businessTimeHeader]: demoTime }));
    resetBusinessTime();
    expect(Math.abs(appNow().getTime() - Date.now())).toBeLessThan(5_000);
    expect(window.sessionStorage.getItem(businessTimeKey)).toBeNull();
  });
});
