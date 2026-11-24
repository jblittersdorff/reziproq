import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type AuditActor,
  auditedChange,
  auditedObject,
  diffFields,
  type OutboxEmailPayload,
} from './audit.js';
import { privateColumns } from './layers.js';
import { seedBuyers, seedSupplierOrg } from './seed.js';
import { type TenantTransaction, withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// Tests zu docs/specs/PLT-08.md gegen eine echte PostgreSQL-Datenbank. Bis PLT-03b gibt es noch
// kein Fachobjekt mit Verlauf; der Test legt deshalb ein geteiltes Probe-Objekt an, wie jede neue
// Fachtabelle über app_apply_layer.

const testOem = seedBuyers.testOem.id;
const zweitOem = seedBuyers.zweitOem.id;

const lena: AuditActor = {
  userId: 'demo-test-oem-1',
  name: 'Lena Berger',
  organizationId: testOem,
};
const mara: AuditActor = {
  userId: 'demo-zweit-oem-1',
  name: 'Mara Vogel',
  organizationId: zweitOem,
};

/** Probe-Objekt mit Verlauf: Status und Titel sind geteilt, mehr nicht. */
const probeObject = auditedObject({
  type: 'probe_objekt',
  visibility: 'shared',
  fields: ['status', 'titel'],
});

describe('PLT-08: Verlauf in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  let relationshipA = '';
  let relationshipB = '';

  const as = <T>(actor: AuditActor, work: (tx: TenantTransaction) => Promise<T>) =>
    withTenant(temp.db, { userId: actor.userId, organizationId: actor.organizationId }, work);

  /** Legt ein Probe-Objekt mit Verlauf an und gibt seine ID zurück. */
  const createProbe = (
    actor: AuditActor,
    relationshipId: string,
    titel = 'Erster Entwurf',
    email?: OutboxEmailPayload,
  ) =>
    as(actor, (tx) =>
      auditedChange(tx, actor, probeObject, async () => {
        const id = randomUUID();
        await tx.execute(sql`
          insert into probe_objekt (id, relationship_id, owner_org_id, visibility, status, titel, spend_cents)
          values (${id}, ${relationshipId}, ${actor.organizationId}, 'shared', 'draft', ${titel}, 4200)
        `);
        return {
          objectId: id,
          relationshipId,
          action: 'created',
          after: { status: 'draft', titel, spend_cents: 4200 },
          ...(email ? { email } : {}),
          result: id,
        };
      }),
    );

  const eventsFor = async (objectId: string) =>
    (
      await temp.db.execute<{
        actor_user_id: string;
        actor_name: string;
        actor_org_id: string;
        action: string;
        changes: Record<string, { from: unknown; to: unknown }>;
        occurred_at: Date;
        visibility: string;
      }>(sql`select * from audit_event where object_id = ${objectId} order by occurred_at, id`)
    ).rows;

  const outboxFor = async (objectId: string) =>
    (
      await temp.db.execute<{
        audit_event_id: string;
        event_type: string;
        processed_at: Date | null;
      }>(
        sql`select audit_event_id, event_type, processed_at from outbox_event where object_id = ${objectId}`,
      )
    ).rows;

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'seeded' });
    const relationship = async (buyer: string) => {
      const result = await temp.db.execute<{ id: string }>(sql`
        update relationship set status = 'active'
        where buyer_org_id = ${buyer} and supplier_org_id = ${seedSupplierOrg.id}
        returning id::text
      `);
      return result.rows[0]?.id ?? '';
    };
    relationshipA = await relationship(testOem);
    relationshipB = await relationship(zweitOem);
    await temp.db.execute(sql`
      create table probe_objekt (
        id uuid primary key, relationship_id uuid not null, owner_org_id uuid not null,
        visibility text not null, status text not null, titel text not null, spend_cents bigint
      )
    `);
    await temp.db.execute(sql`select app_apply_layer('probe_objekt', 'shared')`);
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('Jede Änderung an einem Objekt mit Verlauf erzeugt genau einen Eintrag mit Person, Organisation, Zeit, Aktion und alten und neuen Werten', async () => {
    const before = new Date();
    const id = await createProbe(lena, relationshipA);
    await as(lena, (tx) =>
      auditedChange(tx, lena, probeObject, async () => {
        await tx.execute(sql`update probe_objekt set status = 'active' where id = ${id}`);
        return {
          objectId: id,
          relationshipId: relationshipA,
          action: 'updated',
          before: { status: 'draft', titel: 'Erster Entwurf' },
          after: { status: 'active', titel: 'Erster Entwurf' },
          result: undefined,
        };
      }),
    );

    const events = await eventsFor(id);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      actor_user_id: 'demo-test-oem-1',
      actor_name: 'Lena Berger',
      actor_org_id: testOem,
      action: 'updated',
      visibility: 'shared',
      changes: { status: { from: 'draft', to: 'active' } },
    });
    expect(events[0]?.changes).toEqual({
      status: { from: null, to: 'draft' },
      titel: { from: null, to: 'Erster Entwurf' },
    });
    expect(new Date(String(events[1]?.occurred_at)).getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1000,
    );
  });

  describe('UPDATE und DELETE auf audit_event scheitern, auch mit der Rolle der API', () => {
    it.each([
      ['UPDATE', sql`update audit_event set action = 'approved'`],
      ['DELETE', sql`delete from audit_event`],
    ])('%s mit der Rolle der API', async (_name, statement) => {
      await createProbe(lena, relationshipA);
      const error = await as(lena, (tx) => tx.execute(statement)).catch(
        (caught: unknown) => caught,
      );
      expect(String((error as Error).cause)).toMatch(/permission denied/);
    });

    it.each([
      ['UPDATE', sql`update audit_event set action = 'approved'`],
      ['DELETE', sql`delete from audit_event`],
      ['TRUNCATE', sql`truncate audit_event`],
    ])('%s auch als Eigentümer der Tabelle', async (_name, statement) => {
      const count = async () =>
        Number(
          (await temp.db.execute<{ n: string }>(sql`select count(*) as n from audit_event`)).rows[0]
            ?.n,
        );
      const before = await count();
      const error = await temp.db.execute(statement).catch((caught: unknown) => caught);
      expect(String((error as Error).cause)).toMatch(/Der Verlauf ist unveränderlich/);
      expect(await count()).toBe(before);
    });
  });

  describe('Scheitert die Änderung, entsteht kein Eintrag. Scheitert der Eintrag, wird die Änderung zurückgerollt.', () => {
    it('Scheitert die Änderung, entsteht kein Eintrag', async () => {
      const id = randomUUID();
      const error = await as(lena, (tx) =>
        auditedChange(tx, lena, probeObject, async () => {
          // Fehlender Titel: Die Datenbank lehnt die Zeile ab.
          await tx.execute(sql`
            insert into probe_objekt (id, relationship_id, owner_org_id, visibility, status, titel)
            values (${id}, ${relationshipA}, ${testOem}, 'shared', 'draft', null)
          `);
          return { objectId: id, relationshipId: relationshipA, action: 'created', result: id };
        }),
      ).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      expect(await eventsFor(id)).toEqual([]);
      expect(await outboxFor(id)).toEqual([]);
    });

    it('Scheitert der Eintrag, wird die Änderung zurückgerollt', async () => {
      const id = await createProbe(lena, relationshipA, 'Vorher');
      const error = await as(lena, (tx) =>
        auditedChange(tx, lena, probeObject, async () => {
          await tx.execute(sql`update probe_objekt set titel = 'Nachher' where id = ${id}`);
          // Eine unbekannte Aktion lehnt audit_event ab.
          return {
            objectId: id,
            relationshipId: relationshipA,
            action: 'deleted' as 'updated',
            before: { titel: 'Vorher' },
            after: { titel: 'Nachher' },
            result: undefined,
          };
        }),
      ).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      const titel = await temp.db.execute<{ titel: string }>(
        sql`select titel from probe_objekt where id = ${id}`,
      );
      expect(titel.rows).toEqual([{ titel: 'Vorher' }]);
      expect(await eventsFor(id)).toHaveLength(1);
    });
  });

  it('Ein Nutzer des Zweit-OEM sieht keinen Verlaufseintrag des Test-OEM (Test-Gerüst aus PLT-04)', async () => {
    const own = await createProbe(lena, relationshipA);
    const other = await createProbe(mara, relationshipB);
    const seen = (actor: AuditActor) =>
      as(actor, async (tx) => {
        const result = await tx.execute<{ object_id: string; actor_org_id: string }>(
          sql`select object_id, actor_org_id::text from audit_event`,
        );
        return result.rows;
      });
    const zweit = await seen(mara);
    expect(zweit.map((row) => row.object_id)).toContain(other);
    expect(zweit.filter((row) => row.actor_org_id === testOem)).toEqual([]);
    const test = await seen(lena);
    expect(test.map((row) => row.object_id)).toContain(own);
    expect(test.filter((row) => row.actor_org_id === zweitOem)).toEqual([]);
    // Die übrigen Prüfungen aus PLT-04 laufen für audit_event in layers.test.ts (Register).
  });

  it('Ein geteilter Verlaufseintrag enthält keine Felder aus privaten Tabellen', async () => {
    // Was das Objekt nicht freigibt, verwirft der Verlauf, z. B. den Spend aus createProbe.
    const id = await createProbe(lena, relationshipA);
    const [created] = await eventsFor(id);
    expect(Object.keys(created?.changes ?? {}).sort()).toEqual(['status', 'titel']);
    expect(JSON.stringify(created)).not.toContain('4200');

    // Ein Objekt, das ein Feld einer privaten Tabelle teilen würde, fällt in der Prüfung auf.
    const columns = await privateColumns(temp.db);
    expect(columns.get('amount_cents')).toEqual(expect.arrayContaining(['relationship_spend']));
    expect(columns.get('external_ref')).toEqual(['relationship_side']);
    const leaky = auditedObject({
      type: 'x',
      visibility: 'shared',
      fields: ['status', 'external_ref'],
    });
    expect(leaky.fields.filter((field) => columns.has(field))).toEqual(['external_ref']);
    expect(probeObject.fields.filter((field) => columns.has(field))).toEqual([]);

    // Alle geteilten Einträge in der Datenbank sind frei von solchen Feldern.
    const shared = await temp.db.execute<{ keys: string[] }>(sql`
      select array(select jsonb_object_keys(changes)) as keys from audit_event where visibility = 'shared'
    `);
    const keys = shared.rows.flatMap((row) => row.keys);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => columns.has(key))).toEqual([]);
  });

  it('diffFields trägt nur geänderte, freigegebene Felder ein', () => {
    expect(
      diffFields(
        probeObject,
        { status: 'draft', titel: 'A', spend_cents: 1 },
        { status: 'draft', titel: 'B', spend_cents: 2 },
      ),
    ).toEqual({ titel: { from: 'A', to: 'B' } });
  });

  it('Zu jedem Verlaufseintrag gibt es einen Outbox-Eintrag', async () => {
    const id = await createProbe(lena, relationshipA);
    const [event] = (
      await temp.db.execute<{ id: string }>(
        sql`select id::text from audit_event where object_id = ${id}`,
      )
    ).rows;
    expect(await outboxFor(id)).toEqual([
      { audit_event_id: event?.id, event_type: 'probe_objekt.created', processed_at: null },
    ]);
    const orphans = await temp.db.execute<{ n: string }>(sql`
      select count(*) as n from audit_event a
      where (select count(*) from outbox_event o where o.audit_event_id = a.id) <> 1
    `);
    expect(Number(orphans.rows[0]?.n)).toBe(0);
  });

  it('Eine Mail liegt mit dem Verlauf in genau demselben Outbox-Eintrag', async () => {
    const id = await createProbe(lena, relationshipA, 'Einladung Beispiel AG (Demo)', {
      template: 'invitation',
      locale: 'de',
      recipient: 'anna@example.com',
      firstName: 'Anna',
      title: 'Einladung Beispiel AG (Demo)',
      deadline: '30. Juni 2027',
      link: '/bewertungen/123',
    });
    const entries = await temp.db.execute<{
      event_type: string;
      email_template: string;
      email_locale: string;
      email_recipient: string;
      email_title: string;
      email_link: string;
    }>(sql`
      select event_type, email_template, email_locale, email_recipient, email_title, email_link
      from outbox_event where object_id = ${id}
    `);

    expect(entries.rows).toEqual([
      {
        event_type: 'email.invitation',
        email_template: 'invitation',
        email_locale: 'de',
        email_recipient: 'anna@example.com',
        email_title: 'Einladung Beispiel AG (Demo)',
        email_link: '/bewertungen/123',
      },
    ]);
  });

  it('Die API liest die Outbox nicht', async () => {
    const error = await as(lena, (tx) => tx.execute(sql`select * from outbox_event`)).catch(
      (caught: unknown) => caught,
    );
    expect(String((error as Error).cause)).toMatch(/permission denied/);
  });

  it('Nur die Betriebsrolle liest Outbox und E-Mail-Protokoll', async () => {
    const objectId = await createProbe(lena, relationshipA, 'Einladung Beispiel AG (Demo)', {
      template: 'invitation',
      locale: 'de',
      recipient: 'anna@example.com',
      title: 'Einladung Beispiel AG (Demo)',
      link: '/bewertungen/123',
    });
    const [outbox] = (
      await temp.db.execute<{ id: string }>(
        sql`select id::text from outbox_event where object_id = ${objectId}`,
      )
    ).rows;
    const outboxId = outbox?.id;
    if (!outboxId) throw new Error('Outbox-Ereignis fehlt.');

    const logRows = await temp.db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_jobs`);
      const events = await tx.execute<{ email_recipient: string }>(sql`
        select email_recipient from outbox_event where id = ${outboxId}
      `);
      await tx.execute(sql`
        insert into email_log (outbox_event_id, template, status, recipient_hash)
        values (${outboxId}, 'invitation', 'sending', 'test-hash')
      `);
      const logs = await tx.execute<{ status: string }>(sql`
        select status from email_log where outbox_event_id = ${outboxId}
      `);
      return { events: events.rows, logs: logs.rows };
    });
    expect(logRows).toEqual({
      events: [{ email_recipient: 'anna@example.com' }],
      logs: [{ status: 'sending' }],
    });

    const apiError = await as(lena, (tx) => tx.execute(sql`select * from email_log`)).catch(
      (caught: unknown) => caught,
    );
    expect(String((apiError as Error).cause)).toMatch(/permission denied/);
  });

  it('Einträge zu internen Objekten ohne Beziehung sieht nur die eigene Organisation', async () => {
    const internal = auditedObject({ type: 'rolle', visibility: 'internal', fields: ['rolle'] });
    const id = randomUUID();
    await as(lena, (tx) =>
      auditedChange(tx, lena, internal, async () => ({
        objectId: id,
        relationshipId: null,
        action: 'updated',
        before: { rolle: 'viewer' },
        after: { rolle: 'member' },
        result: undefined,
      })),
    );
    const count = (actor: AuditActor) =>
      as(actor, async (tx) =>
        Number(
          (
            await tx.execute<{ n: string }>(
              sql`select count(*) as n from audit_event where object_id = ${id}`,
            )
          ).rows[0]?.n,
        ),
      );
    expect(await count(lena)).toBe(1);
    expect(await count(mara)).toBe(0);
  });
});
