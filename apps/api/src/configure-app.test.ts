import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from './testing/test-app.js';

// NAV-10 TN-07 (K1-d): Alte Adressen der App leiten mit 301 auf die neuen weiter, bevor die API die
// App ausliefert; Lesezeichen und Links in Mails funktionieren weiter. Die API selbst bleibt unberührt.
describe('Weiterleitungen mit 301 (TN-07)', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  const open = (path: string, method = 'GET') =>
    fetch(`${testApp.baseUrl}${path}`, { method, redirect: 'manual' });

  beforeAll(async () => {
    testApp = await startTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('jede aktive alte Adresse aus NAV-10 antwortet mit 301 und der neuen Adresse', async () => {
    const moves: [string, string][] = [
      ['/mein-tag', '/heute'],
      ['/start', '/heute'],
      ['/start/', '/heute'],
      ['/uebersicht', '/wert'],
      ['/wirkung?sicht=ebit&gj=2026', '/wert?sicht=ebit&gj=2026'],
      ['/lieferanten?ansicht=matrix', '/beziehungen?ansicht=matrix'],
      ['/agenten', '/mein-agent'],
      ['/einstellungen/ki/agenten', '/mein-agent'],
      // HE-01 (K1-e): Neu eingegangen und Hinweise gehen in Heute auf
      ['/mein-tag/eingang', '/heute?ansicht=alles'],
      ['/hinweise', '/heute?ansicht=alles'],
      [
        '/hinweise/550e8400-e29b-41d4-a716-446655440030',
        '/warum/550e8400-e29b-41d4-a716-446655440030',
      ],
    ];
    for (const [from, to] of moves) {
      const response = await open(from);
      expect(response.status, from).toBe(301);
      expect(response.headers.get('location'), from).toBe(to);
    }
    expect((await open('/mein-tag', 'HEAD')).status).toBe(301);
  });

  it('neue Adressen, Unterseiten mit späterem Paket, andere Methoden und die API leiten nicht weiter', async () => {
    for (const path of [
      '/heute',
      '/lieferanten/550e8400-e29b-41d4-a716-446655440010/plan',
      '/einstellungen/ki/agenten/neu',
      '/kurz-pruefen',
      '/kunden/550e8400-e29b-41d4-a716-446655440010/plan',
    ]) {
      expect((await open(path)).status, path).not.toBe(301);
    }
    expect((await open('/mein-tag', 'POST')).status).not.toBe(301);
    expect((await open('/api/heute')).status).toBe(401);
  });
});
