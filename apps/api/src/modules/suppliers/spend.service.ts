import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, auditedChange, desc, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { SaveSpendEntry, SpendEntry, SpendOverview, SpendYearTotal } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { relationshipSpendAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { assertWritable, ownRelationship, teamRoleOf } from './suppliers.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

type Row = {
  id: string;
  year: number;
  kind: 'actual' | 'plan';
  amountCents: number;
  currency: string;
  businessUnitId: string | null;
  businessUnitName: string | null;
  materialGroupId: string | null;
  materialGroupName: string | null;
};

/** Anteile einer Jahressumme je Schlüssel; ohne Zuordnung zuletzt. */
function parts(rows: Row[], key: 'businessUnit' | 'materialGroup') {
  const sums = new Map<string | null, { name: string | null; amountCents: number }>();
  for (const row of rows) {
    const id = row[`${key}Id`];
    const entry = sums.get(id) ?? { name: row[`${key}Name`], amountCents: 0 };
    entry.amountCents += row.amountCents;
    sums.set(id, entry);
  }
  return [...sums.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) =>
      a.id === null ? 1 : b.id === null ? -1 : (a.name ?? '').localeCompare(b.name ?? '', 'de'),
    );
}

const basisPoints = (part: number, whole: number) =>
  whole > 0 ? Math.round((part * 10_000) / whole) : null;

/**
 * SPL-04: Spend-Entwicklung eines Lieferanten, nur für den Käufer (käuferprivat). Summen je Jahr,
 * Business Unit und Warengruppe rechnet die Datenbank-Sicht bzw. dieser Dienst aus den Zeilen.
 */
@Injectable()
export class SpendService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private run<T>(
    auth: AuthContext,
    relationshipId: string,
    work: (tx: TenantTransaction) => Promise<T>,
  ) {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'lieferanten.sehen')) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      return work(tx);
    });
  }

  overview(auth: AuthContext, relationshipId: string): Promise<SpendOverview> {
    return this.run(auth, relationshipId, (tx) => this.read(tx, auth, relationshipId));
  }

  save(
    auth: AuthContext,
    relationshipId: string,
    entryId: string | null,
    input: SaveSpendEntry,
  ): Promise<SpendOverview> {
    return this.run(auth, relationshipId, async (tx) => {
      const organization = auth.organization as NonNullable<AuthContext['organization']>;
      await assertWritable(tx, auth, organization, relationshipId);
      await this.assertCatalog(tx, organization.id, input);
      const before = entryId ? await this.entry(tx, relationshipId, entryId) : null;
      const actor = await actorOf(tx, auth, organization.id);
      const values = {
        year: input.year,
        kind: input.kind,
        businessUnitId: input.businessUnitId,
        materialGroupId: input.materialGroupId,
        amountCents: input.amountCents,
        currency: input.currency,
        source: 'manual' as const,
      };
      try {
        await auditedChange(tx, actor, relationshipSpendAudit, async () => {
          if (entryId) {
            await tx
              .update(schema.relationshipSpend)
              .set(values)
              .where(eq(schema.relationshipSpend.id, entryId));
          } else {
            await tx.insert(schema.relationshipSpend).values({ ...values, relationshipId });
          }
          return {
            objectId: relationshipId,
            relationshipId,
            action: before ? ('updated' as const) : ('created' as const),
            before: before ? { year: before.year, amount_cents: before.amountCents } : null,
            after: { year: input.year, amount_cents: input.amountCents },
            result: undefined,
          };
        });
      } catch (error) {
        // Eindeutig je Jahr, Art, Business Unit und Warengruppe.
        if ((error as { cause?: { code?: string } }).cause?.code === '23505') {
          throw new ConflictException({ statusCode: 409, code: 'duplicate_entry' });
        }
        throw error;
      }
      return this.read(tx, auth, relationshipId);
    });
  }

  remove(auth: AuthContext, relationshipId: string, entryId: string): Promise<SpendOverview> {
    return this.run(auth, relationshipId, async (tx) => {
      const organization = auth.organization as NonNullable<AuthContext['organization']>;
      await assertWritable(tx, auth, organization, relationshipId);
      const before = await this.entry(tx, relationshipId, entryId);
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, relationshipSpendAudit, async () => {
        await tx.delete(schema.relationshipSpend).where(eq(schema.relationshipSpend.id, entryId));
        return {
          objectId: relationshipId,
          relationshipId,
          action: 'updated' as const,
          before: { year: before.year, amount_cents: before.amountCents },
          after: null,
          result: undefined,
        };
      });
      return this.read(tx, auth, relationshipId);
    });
  }

  private async entry(tx: TenantTransaction, relationshipId: string, entryId: string) {
    const [row] = await tx
      .select()
      .from(schema.relationshipSpend)
      .where(
        and(
          eq(schema.relationshipSpend.id, entryId),
          eq(schema.relationshipSpend.relationshipId, relationshipId),
        ),
      );
    if (!row) throw notFound();
    return row;
  }

  /** Business Unit und Warengruppe müssen zur eigenen Organisation gehören. */
  private async assertCatalog(tx: TenantTransaction, orgId: string, input: SaveSpendEntry) {
    if (input.businessUnitId) {
      const [unit] = await tx
        .select({ id: schema.businessUnit.id })
        .from(schema.businessUnit)
        .where(
          and(
            eq(schema.businessUnit.id, input.businessUnitId),
            eq(schema.businessUnit.orgId, orgId),
          ),
        );
      if (!unit) throw new ConflictException({ statusCode: 409, code: 'unknown_business_unit' });
    }
    if (input.materialGroupId) {
      const [group] = await tx
        .select({ id: schema.materialGroup.id })
        .from(schema.materialGroup)
        .where(
          and(
            eq(schema.materialGroup.id, input.materialGroupId),
            eq(schema.materialGroup.orgId, orgId),
          ),
        );
      if (!group) throw new ConflictException({ statusCode: 409, code: 'unknown_material_group' });
    }
  }

  private async read(
    tx: TenantTransaction,
    auth: AuthContext,
    relationshipId: string,
  ): Promise<SpendOverview> {
    const rows: Row[] = await tx
      .select({
        id: schema.relationshipSpend.id,
        year: schema.relationshipSpend.year,
        kind: schema.relationshipSpend.kind,
        amountCents: schema.relationshipSpend.amountCents,
        currency: schema.relationshipSpend.currency,
        businessUnitId: schema.relationshipSpend.businessUnitId,
        businessUnitName: schema.businessUnit.name,
        materialGroupId: schema.relationshipSpend.materialGroupId,
        materialGroupName: schema.materialGroup.name,
      })
      .from(schema.relationshipSpend)
      .leftJoin(
        schema.businessUnit,
        eq(schema.businessUnit.id, schema.relationshipSpend.businessUnitId),
      )
      .leftJoin(
        schema.materialGroup,
        eq(schema.materialGroup.id, schema.relationshipSpend.materialGroupId),
      )
      .where(eq(schema.relationshipSpend.relationshipId, relationshipId))
      .orderBy(desc(schema.relationshipSpend.year), asc(schema.relationshipSpend.kind));

    // Währung des Diagramms: die des jüngsten Ist-Jahres, sonst der jüngsten Zeile.
    const currency =
      rows.find((row) => row.kind === 'actual')?.currency ?? rows[0]?.currency ?? null;
    const inCurrency = rows.filter((row) => row.currency === currency);
    const keys = [...new Set(inCurrency.map((row) => `${row.year}:${row.kind}`))];
    const years: SpendYearTotal[] = keys
      .map((key) => {
        const [year, kind] = key.split(':') as [string, 'actual' | 'plan'];
        const group = inCurrency.filter((row) => row.year === Number(year) && row.kind === kind);
        return {
          year: Number(year),
          kind,
          amountCents: group.reduce((sum, row) => sum + row.amountCents, 0),
          byBusinessUnit: parts(group, 'businessUnit'),
          byMaterialGroup: parts(group, 'materialGroup'),
        };
      })
      .sort((a, b) => a.year - b.year || a.kind.localeCompare(b.kind));

    const actual = years.filter((entry) => entry.kind === 'actual');
    const last = actual.at(-1);
    let kpis: SpendOverview['kpis'] = null;
    if (last && currency) {
      const previous = actual.find((entry) => entry.year === last.year - 1);
      // Anteil am gesamten Ist-Spend des Käufers im selben Jahr; nur bei einheitlicher Währung.
      const totals = await tx
        .select({
          currency: schema.relationshipSpendTotal.currency,
          amountCents: schema.relationshipSpendTotal.amountCents,
        })
        .from(schema.relationshipSpendTotal)
        .innerJoin(
          schema.relationship,
          eq(schema.relationship.id, schema.relationshipSpendTotal.relationshipId),
        )
        .where(
          and(
            eq(schema.relationshipSpendTotal.year, last.year),
            eq(schema.relationship.buyerOrgId, auth.organization?.id as string),
          ),
        );
      const mixed = totals.some((row) => row.currency !== currency);
      const whole = totals.reduce((sum, row) => sum + row.amountCents, 0);
      kpis = {
        year: last.year,
        amount: { amountCents: last.amountCents, currency },
        previous: previous ? { amountCents: previous.amountCents, currency } : null,
        changeBasisPoints: previous
          ? basisPoints(last.amountCents - previous.amountCents, previous.amountCents)
          : null,
        shareBasisPoints: mixed ? null : basisPoints(last.amountCents, whole),
      };
    }

    const entries: SpendEntry[] = rows.map((row) => ({
      id: row.id,
      year: row.year,
      kind: row.kind,
      businessUnit:
        row.businessUnitId && row.businessUnitName
          ? { id: row.businessUnitId, name: row.businessUnitName }
          : null,
      materialGroup:
        row.materialGroupId && row.materialGroupName
          ? { id: row.materialGroupId, name: row.materialGroupName }
          : null,
      amount: { amountCents: row.amountCents, currency: row.currency },
    }));

    const orgId = auth.organization?.id as string;
    const teamRole = await teamRoleOf(tx, auth.userId, relationshipId);
    return {
      currency,
      otherCurrencies: [...new Set(rows.map((row) => row.currency))].filter(
        (entry) => entry !== currency,
      ),
      years,
      kpis,
      entries,
      options: {
        businessUnits: await tx
          .select({ id: schema.businessUnit.id, name: schema.businessUnit.name })
          .from(schema.businessUnit)
          .where(and(eq(schema.businessUnit.orgId, orgId), eq(schema.businessUnit.active, true)))
          .orderBy(asc(schema.businessUnit.name)),
        materialGroups: await tx
          .select({ id: schema.materialGroup.id, name: schema.materialGroup.name })
          .from(schema.materialGroup)
          .where(and(eq(schema.materialGroup.orgId, orgId), eq(schema.materialGroup.active, true)))
          .orderBy(asc(schema.materialGroup.name)),
      },
      canEdit: can(auth, 'lieferanten.bearbeiten', { teamRole }),
    };
  }
}
