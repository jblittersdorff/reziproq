import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { meResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLT-09.md über die API: Sprache je Person, gespeichert in app_user.

describe('PLT-09: Sprache über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const userId = `p09-${randomUUID()}`;

  const token = () => testApp.signToken({ subject: userId });
  const login = async (body: unknown) =>
    meResponseSchema.parse(
      await (await testApp.post('/api/me/anmeldung', body, await token())).json(),
    );
  const me = async () =>
    meResponseSchema.parse(await (await testApp.get('/api/me', await token())).json());
  const setLocale = async (locale: unknown) =>
    fetch(`${testApp.baseUrl}/api/me/sprache`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ locale }),
    });
  const stored = async () =>
    (
      await db
        .select({ locale: schema.appUser.locale })
        .from(schema.appUser)
        .where(sql`${schema.appUser.id} = ${userId}`)
    )[0]?.locale;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
  });

  beforeEach(async () => {
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`);
    testApp.zitadel.replyUserinfo(() => ({
      status: 200,
      body: { sub: userId, name: 'Emma English', given_name: 'Emma', email: 'emma@example.com' },
    }));
  });

  afterAll(async () => {
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`);
    await testApp.close();
  });

  it('Beim ersten Login kommt die Sprache aus dem Browser, sonst Deutsch', async () => {
    expect((await login({ browserLocale: 'en' })).locale).toBe('en');
    expect(await stored()).toBe('en');

    await db.delete(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`);
    // Ohne Angabe (ältere Clients) gilt Deutsch.
    expect((await login({})).locale).toBe('de');
  });

  it('Die Umstellung bleibt nach Abmelden und erneutem Anmelden erhalten, auch auf einem anderen Gerät', async () => {
    await login({ browserLocale: 'de' });
    const res = await setLocale('en');
    expect(res.status).toBe(204);
    expect(await stored()).toBe('en');
    expect((await me()).locale).toBe('en');

    // Neue Anmeldung auf einem Gerät mit deutschem Browser: Die gespeicherte Sprache gilt.
    expect((await login({ browserLocale: 'de' })).locale).toBe('en');
  });

  it('nimmt nur de und en an und antwortet sonst mit einem Fehlercode je Feld', async () => {
    await login({ browserLocale: 'de' });
    const res = await setLocale('fr');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ errors: { locale: [expect.any(String)] } });
    expect(await stored()).toBe('de');
    expect(
      (await testApp.post('/api/me/anmeldung', { browserLocale: 'fr' }, await token())).status,
    ).toBe(400);
  });

  it('ohne Token kann niemand eine Sprache setzen', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/me/sprache`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'en' }),
    });
    expect(res.status).toBe(401);
  });
});
