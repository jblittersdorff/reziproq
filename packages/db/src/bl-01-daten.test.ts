import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTempDatabase } from './testing/temp-database.js';

// PO-01, BL-01 (K2-d.1): Daten für „Mail rein, Zusage raus“ und Bestätigen per Link gegen eine echte
// PostgreSQL-Datenbank. Der Link speichert nur den Hash von Token und Code, gilt für ein bis
// zwanzig Objekte und hat ein Ergebnis nur zusammen mit dem Zeitpunkt der Nutzung.

const buyer = '00000000-0000-7000-8000-0000000b1001';
const supplier = '00000000-0000-7000-8000-0000000b1002';
const relationship = '00000000-0000-7000-8000-0000000b1003';
const object = '00000000-0000-7000-8000-0000000b1004';
const hash = () => randomBytes(32).toString('hex');

describe('BL-01 und PO-01 in der Datenbank (K2-d.1)', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'migrated' });
    await temp.db.execute(sql`
      insert into organization (id, name) values
        (${buyer}, 'Käufer BL-01'), (${supplier}, 'Lieferant BL-01')`);
    await temp.db.execute(sql`
      insert into app_user (id, name, email, organization_id, org_role)
      values ('bl01-kaeufer', 'Kim', 'kim@kaeufer.example', ${buyer}, 'admin')`);
    await temp.db.execute(sql`
      insert into relationship (id, buyer_org_id, supplier_org_id, status)
      values (${relationship}, ${buyer}, ${supplier}, 'active')`);
  });

  afterAll(async () => {
    await temp?.drop();
  });

  const link = (values: {
    token?: string;
    code?: string | null;
    objects?: string;
    used?: boolean;
  }) =>
    temp.db.execute(sql`
      insert into confirm_link (org_id, relationship_id, name, email, object_ids, token_hash,
        code_hash, created_by, expires_at, used_at, result)
      values (${buyer}, ${relationship}, 'Nils Ott', 'nils@lieferant.example',
        ${values.objects ?? `{${object}}`}::uuid[], ${values.token ?? hash()}, ${values.code ?? null},
        'bl01-kaeufer', app_now() + interval '14 days',
        ${values.used ? sql`app_now()` : null}, ${values.used ? 'confirmed' : null})`);

  it('ein Link mit Hash von Token und Code und einem Objekt lässt sich anlegen', async () => {
    await expect(link({ code: hash() })).resolves.toBeDefined();
    await expect(link({ used: true })).resolves.toBeDefined();
  });

  it('Token und Code nie im Klartext, kein Link ohne Objekt oder mit mehr als zwanzig', async () => {
    await expect(link({ token: 'klartext-token' })).rejects.toThrow();
    await expect(link({ code: '123456' })).rejects.toThrow();
    await expect(link({ objects: '{}' })).rejects.toThrow();
    const many = `{${Array.from({ length: 21 }, () => object).join(',')}}`;
    await expect(link({ objects: many })).rejects.toThrow();
  });

  it('ein Ergebnis gibt es nur mit dem Zeitpunkt der Nutzung', async () => {
    await expect(
      temp.db.execute(sql`
        insert into confirm_link (org_id, relationship_id, name, email, object_ids, token_hash,
          created_by, expires_at, result)
        values (${buyer}, ${relationship}, 'Nils Ott', 'nils@lieferant.example',
          ${`{${object}}`}::uuid[], ${hash()}, 'bl01-kaeufer', app_now() + interval '14 days',
          'confirmed')`),
    ).rejects.toThrow();
  });

  it('eine Mail kennt, wer zugeordnet hat, und eine Konfidenz zwischen 0 und 1', async () => {
    const mail = (assignedBy: string, confidence: number | null) =>
      temp.db.execute(sql`
        insert into filed_mail (org_id, relationship_id, filed_by, visibility, message_id,
          from_email, sent_at, subject, body_text, source, assigned_by, assign_confidence)
        values (${buyer}, ${relationship}, 'bl01-kaeufer', 'team',
          ${`<${hash()}@lieferant.example>`}, 'kim@lieferant.example', app_now(), 'Betreff',
          'Text', 'forward', ${assignedBy}, ${confidence})`);
    await expect(mail('reziproq', 0.95)).resolves.toBeDefined();
    await expect(mail('human', null)).resolves.toBeDefined();
    await expect(mail('bot', 0.95)).rejects.toThrow();
    await expect(mail('reziproq', 1.5)).rejects.toThrow();
  });
});
