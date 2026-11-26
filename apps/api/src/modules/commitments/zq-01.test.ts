import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';
import {
  commitmentQuote,
  keptEvidence,
  replaceCommitment,
  replacedStatus,
  statusFields,
} from './commitment-rules.js';

// ZQ-01 (K2-a.2): Regeln der Zusagen gegen die echte Datenbank, mit den Rechten der Seiten.
// Gehalten nur mit Beleg (T2-ZQ2), Ersatz nach E-K2-2 (Regel 3) und die Quote je Seite: nur
// beidseitig bestätigte Zusagen zählen (T2-05 mit 7 von 9 und 7 von 10).

describe('ZQ-01 Regeln der Zusagen', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const buyer = randomUUID();
  const supplier = randomUUID();
  const relationship = randomUUID();
  const asSupplier = { userId: 'zq-kam', organizationId: supplier, customerOrganizationId: buyer };
  const asBuyer = { userId: 'zq-sro', organizationId: buyer };

  /** Geteilte Zusage des Lieferanten, direkt in der Datenbank */
  async function supplierCommitment(input: {
    title: string;
    dueOn: string;
    status?: 'open' | 'kept' | 'missed';
    confirm?: 'both_confirmed' | 'supplier_confirmed';
  }) {
    const [row] = await db
      .insert(schema.commitment)
      .values({
        relationshipId: relationship,
        ownerOrgId: supplier,
        visibility: 'shared',
        side: 'supplier',
        title: input.title,
        ownerName: 'Kim Kaiser',
        dueOn: input.dueOn,
        status: input.status ?? 'open',
        fulfilledEvidence: input.status === 'kept' ? { kind: 'goods_receipt' } : null,
        confirmState: input.confirm ?? 'supplier_confirmed',
        createdBy: 'zq-kam',
        createdByName: 'Kim Kaiser',
      })
      .returning();
    if (!row) throw new Error('Zusage fehlt');
    return row;
  }

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    await db.execute(sql`
      insert into organization (id, name) values
        (${buyer}, 'ZQ Käufer (Demo)'), (${supplier}, 'ZQ Lieferant (Demo)')`);
    await db.execute(sql`
      insert into relationship (id, buyer_org_id, supplier_org_id, status)
      values (${relationship}, ${buyer}, ${supplier}, 'active')`);
  });

  afterAll(async () => {
    await db.execute(sql`delete from commitment where relationship_id = ${relationship}`);
    await db.execute(sql`delete from relationship where id = ${relationship}`);
    await db.execute(sql`delete from organization where id in (${buyer}, ${supplier})`);
    await app.close();
  });

  it('T2-ZQ2: gehalten ohne Beleg wird abgelehnt; mit Beleg stehen Person und Zeitpunkt dabei', () => {
    expect(() => keptEvidence(undefined, { userId: 'zq-sro', name: 'Jan' })).toThrow(
      expect.objectContaining({ response: { statusCode: 422, code: 'beleg_fehlt' } }),
    );
    expect(() => statusFields('kept', null)).toThrow(
      expect.objectContaining({ response: { statusCode: 422, code: 'beleg_fehlt' } }),
    );
    expect(keptEvidence({ kind: 'goods_receipt' }, { userId: 'zq-sro', name: 'Jan' })).toEqual({
      kind: 'goods_receipt',
      byUserId: 'zq-sro',
      byName: 'Jan',
      at: expect.any(String),
    });
    expect(statusFields('open', null)).toEqual({
      status: 'open',
      fulfilledEvidence: null,
      doneAt: null,
    });
  });

  it('E-K2-2: Ersatz nach verstrichener Frist zählt als verfehlt, vorher als ersetzt', async () => {
    expect(replacedStatus('2026-11-20', '2026-11-26')).toBe('missed');
    expect(replacedStatus('2026-11-26', '2026-11-26')).toBe('replaced');

    const late = await supplierCommitment({ title: '8D-Bericht Charge 4711', dueOn: '2026-01-15' });
    const early = await supplierCommitment({ title: 'Musterteile Starrflex', dueOn: '2099-01-15' });
    const actor = { userId: 'zq-kam', name: 'Kim Kaiser' };
    const results = await withTenant(db, asSupplier, async (tx) => [
      await replaceCommitment(
        tx,
        late,
        {
          title: '8D-Bericht bis Freitag',
          dueOn: '2099-02-01',
          ownerUserId: null,
          ownerName: 'Nils Ott',
        },
        actor,
      ),
      await replaceCommitment(
        tx,
        early,
        {
          title: 'Musterteile bis 11.12.',
          dueOn: '2099-02-11',
          ownerUserId: null,
          ownerName: 'Kim Kaiser',
        },
        actor,
      ),
    ]);
    expect(results.map((entry) => entry.oldStatus)).toEqual(['missed', 'replaced']);
    const rows = (
      await db.execute<{ title: string; status: string; supersedes_id: string | null }>(sql`
        select title, status, supersedes_id from commitment
        where relationship_id = ${relationship} order by title collate "C"`)
    ).rows;
    expect(rows).toEqual([
      { title: '8D-Bericht Charge 4711', status: 'missed', supersedes_id: null },
      { title: '8D-Bericht bis Freitag', status: 'open', supersedes_id: late.id },
      { title: 'Musterteile Starrflex', status: 'replaced', supersedes_id: null },
      { title: 'Musterteile bis 11.12.', status: 'open', supersedes_id: early.id },
    ]);
    // Nur eine offene Zusage lässt sich ersetzen
    await expect(
      withTenant(db, asSupplier, (tx) =>
        replaceCommitment(
          tx,
          { ...late, status: 'missed' },
          { title: 'Noch einmal', dueOn: '2099-03-01', ownerUserId: null, ownerName: 'Nils Ott' },
          actor,
        ),
      ),
    ).rejects.toMatchObject({ response: { code: 'nicht_offen' } });
    // Ersetzen darf nur die zusagende Seite
    const foreign = await supplierCommitment({ title: 'Fremd', dueOn: '2099-04-01' });
    await expect(
      withTenant(db, asBuyer, (tx) =>
        replaceCommitment(
          tx,
          foreign,
          { title: 'Fremd ersetzt', dueOn: '2099-05-01', ownerUserId: null, ownerName: 'Jan' },
          { userId: 'zq-sro', name: 'Jan' },
        ),
      ),
    ).rejects.toThrow();
  });

  it('T2-05: eine verfehlte Zusage senkt die Quote von 78 auf 70 %; eine nur einseitig bestätigte zählt nicht', async () => {
    await db.execute(sql`delete from commitment where relationship_id = ${relationship}`);
    for (let index = 0; index < 9; index += 1) {
      await supplierCommitment({
        title: `Zusage ${index + 1}`,
        dueOn: '2026-03-01',
        status: index < 7 ? 'kept' : 'missed',
        confirm: 'both_confirmed',
      });
    }
    const quote = () => withTenant(db, asBuyer, (tx) => commitmentQuote(tx, relationship, 2026));
    expect((await quote()).supplier).toEqual({ kept: 7, due: 9, percent: 78 });
    await supplierCommitment({
      title: 'Nur Rheintal bestätigt',
      dueOn: '2026-04-01',
      status: 'missed',
      confirm: 'supplier_confirmed',
    });
    expect((await quote()).supplier).toEqual({ kept: 7, due: 9, percent: 78 });
    await supplierCommitment({
      title: 'Verfehlt',
      dueOn: '2026-04-01',
      status: 'missed',
      confirm: 'both_confirmed',
    });
    expect(await quote()).toEqual({
      buyer: { kept: 0, due: 0, percent: null },
      supplier: { kept: 7, due: 10, percent: 70 },
    });
    // Beide Seiten sehen dieselbe Quote (E-K2-3)
    expect(
      (await withTenant(db, asSupplier, (tx) => commitmentQuote(tx, relationship, 2026))).supplier,
    ).toEqual({ kept: 7, due: 10, percent: 70 });
  });
});
