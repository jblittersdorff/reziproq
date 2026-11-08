import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, auditedChange, desc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type CreateSupplierRequest,
  type CreateSupplierResponse,
  createSupplierRequestSchema,
  type ForbiddenCode,
  lastFullYear,
  type Money,
  type SpendRequest,
  type Supplier,
  type SupplierDetail,
  type SupplierLookupQuery,
  type SupplierLookupResponse,
  type SuppliersResponse,
  type TeamRole,
  type UpdateSupplierRequest,
  updateSupplierRequestSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import {
  relationshipAudit,
  relationshipSideAudit,
  relationshipSpendAudit,
} from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { OrganizationService } from '../organizations/organization.service.js';

const forbidden = (code: ForbiddenCode, message: string) =>
  new ForbiddenException({ statusCode: 403, code, message });

@Injectable()
export class SuppliersService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(OrganizationService) private readonly organizations: OrganizationService,
  ) {}

  /**
   * Lieferanten der eigenen Organisation mit Anzahl und Gesamtspend des letzten vollen Jahres
   * (PLT-03). Beendete Beziehungen kommen mit, zählen aber nicht mit.
   */
  async list(auth: AuthContext, spendYear = lastFullYear()): Promise<SuppliersResponse> {
    if (!can(auth, 'lieferanten.sehen')) {
      throw forbidden('keine_berechtigung', 'Dir fehlt eine Rolle, um Lieferanten zu sehen.');
    }
    const organization = this.organizations.current(auth);
    if (!organization) {
      throw forbidden('keine_organisation', 'Du bist noch keiner Organisation zugeordnet.');
    }
    // Käuferfunktionen hängen am Feature buyer der Organisation (PLT-02).
    if (!organization.buyer) {
      throw forbidden('keine_berechtigung', 'Die Lieferantenliste gibt es nur für Käufer.');
    }

    const { suppliers, filters } = await this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => ({
        suppliers: await listSuppliers(tx, spendYear, auth.userId),
        filters: await readFilters(tx),
      }),
    );
    const current = suppliers.filter((supplier) => supplier.status !== 'ended');
    return {
      suppliers,
      filters,
      count: current.length,
      spendYear,
      totalSpend: totalByCurrency(current),
    };
  }

  /**
   * Suche für die Fragen-Seite (PLT-12). Läuft über list(), also mit denselben Rechten und
   * derselben Mandanten-Session wie GET /api/suppliers, und liefert höchstens 20 Treffer.
   */
  async search(auth: AuthContext, filter: SupplierFilter): Promise<Supplier[]> {
    const suppliers = (await this.list(auth, filter.year)).suppliers.filter(
      (s) => s.status !== 'ended',
    );
    const contains = (value: string, part: string | undefined) =>
      !part || value.toLocaleLowerCase('de').includes(part.trim().toLocaleLowerCase('de'));
    // Spend-Filter gelten in Euro. Beträge in anderen Währungen werden nicht umgerechnet und
    // fallen bei gesetztem Filter heraus, statt falsch verglichen zu werden.
    const spendFilter = filter.minSpendEuro !== undefined || filter.maxSpendEuro !== undefined;
    const euro = (supplier: Supplier) => (supplier.spend?.amountCents ?? 0) / 100;

    const hits = suppliers.filter(
      (supplier) =>
        (filter.exactName
          ? supplier.name.toLocaleLowerCase('de') === filter.name?.trim().toLocaleLowerCase('de')
          : contains(supplier.name, filter.name)) &&
        contains(supplier.externalRef ?? '', filter.nummer) &&
        (!filter.land || supplier.country === filter.land.toUpperCase()) &&
        contains((supplier.businessUnits ?? []).join(' '), filter.businessUnit) &&
        contains(supplier.materialGroups.join(' '), filter.materialGroup) &&
        (!spendFilter || supplier.spend?.currency === 'EUR') &&
        (filter.minSpendEuro === undefined || euro(supplier) >= filter.minSpendEuro) &&
        (filter.maxSpendEuro === undefined || euro(supplier) <= filter.maxSpendEuro),
    );
    const sorted = [...hits].sort((a, b) => {
      if (filter.sortierung === 'name') return a.name.localeCompare(b.name, 'de');
      const diff = (a.spend?.amountCents ?? 0) - (b.spend?.amountCents ?? 0);
      return filter.sortierung === 'spend_aufsteigend' ? diff : -diff;
    });
    return sorted.slice(0, Math.min(filter.anzahl ?? 20, 20));
  }
  /** Organisation mit Käuferfunktionen und Recht zum Bearbeiten (PLT-03b), sonst 403. */
  private editor(auth: AuthContext): AccountOrganization {
    const organization = this.organizations.current(auth);
    if (!organization) {
      throw forbidden('keine_organisation', 'Du bist noch keiner Organisation zugeordnet.');
    }
    if (!organization.buyer || !can(auth, 'lieferanten.bearbeiten')) {
      throw forbidden('keine_berechtigung', 'Dir fehlt die Rolle, um Lieferanten zu bearbeiten.');
    }
    return organization;
  }

  /** Lesender Zugriff auf einen einzelnen Lieferanten wie bei der Liste. */
  private reader(auth: AuthContext): AccountOrganization {
    if (!can(auth, 'lieferanten.sehen')) {
      throw forbidden('keine_berechtigung', 'Dir fehlt eine Rolle, um Lieferanten zu sehen.');
    }
    const organization = this.organizations.current(auth);
    if (!organization) {
      throw forbidden('keine_organisation', 'Du bist noch keiner Organisation zugeordnet.');
    }
    if (!organization.buyer) {
      throw forbidden('keine_berechtigung', 'Lieferanten gibt es nur für Käufer.');
    }
    return organization;
  }

  private run<T>(
    auth: AuthContext,
    organization: AccountOrganization,
    work: (tx: TenantTransaction) => Promise<T>,
  ) {
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, work);
  }

  /**
   * Gibt es die Organisation zu dieser USt-IdNr. oder D-U-N-S schon? Nur ja oder nein, nie Name
   * oder Land einer fremden Organisation (PLT-03).
   */
  async lookup(auth: AuthContext, query: SupplierLookupQuery): Promise<SupplierLookupResponse> {
    const organization = this.editor(auth);
    if (!query.ust && !query.duns) return { known: false };
    const known = await this.run(auth, organization, async (tx) => {
      const result = await tx.execute<{ known: boolean }>(
        sql`select app_lieferant_bekannt(${query.ust ?? null}, ${query.duns ?? null}) as known`,
      );
      return result.rows[0]?.known === true;
    });
    return { known };
  }

  /**
   * Legt einen Lieferanten an. Gibt es die Organisation über USt-IdNr. oder D-U-N-S schon,
   * entsteht nur eine neue Beziehung. Alles mit Verlauf, in einer Transaktion.
   */
  async create(auth: AuthContext, input: CreateSupplierRequest): Promise<CreateSupplierResponse> {
    const organization = this.editor(auth);
    const request = createSupplierRequestSchema.parse(input);
    return this.run(auth, organization, async (tx) => {
      const actor = await actorOf(tx, auth, organization.id);
      const found = await tx.execute<{ id: string; existed: boolean }>(sql`
        select id::text, existed from app_lieferant_finden_oder_anlegen(
          ${request.name}, ${request.country}, ${request.vatId ?? null}, ${request.duns ?? null}
        )
      `);
      const supplier = found.rows[0];
      if (!supplier) throw new Error('Lieferant nicht angelegt');

      const { relationship, relationshipSide, relationshipSpend } = schema;
      const [existing] = await tx
        .select({ id: relationship.id })
        .from(relationship)
        .where(
          and(
            eq(relationship.buyerOrgId, organization.id),
            eq(relationship.supplierOrgId, supplier.id),
          ),
        );
      if (existing) {
        throw new ConflictException({
          statusCode: 409,
          code: 'schon_vorhanden',
          message: 'Dieser Lieferant steht schon in deiner Liste.',
          relationshipId: existing.id,
        });
      }

      const relationshipId = await auditedChange(tx, actor, relationshipAudit, async () => {
        const [row] = await tx
          .insert(relationship)
          .values({ buyerOrgId: organization.id, supplierOrgId: supplier.id, status: 'draft' })
          .returning({ id: relationship.id });
        if (!row) throw new Error('Beziehung nicht angelegt');
        return {
          objectId: row.id,
          relationshipId: row.id,
          action: 'created',
          after: { status: 'draft' },
          result: row.id,
        };
      });

      const side = { display_name: request.name, external_ref: request.externalRef ?? null };
      await auditedChange(tx, actor, relationshipSideAudit, async () => {
        await tx.insert(relationshipSide).values({
          relationshipId,
          orgId: organization.id,
          displayName: side.display_name,
          externalRef: side.external_ref,
        });
        return {
          objectId: relationshipId,
          relationshipId,
          action: 'created',
          after: side,
          result: undefined,
        };
      });

      const spend = request.spend;
      if (spend) {
        await auditedChange(tx, actor, relationshipSpendAudit, async () => {
          await tx.insert(relationshipSpend).values({
            relationshipId,
            year: spend.year,
            amountCents: spend.amountCents,
            source: 'manual',
          });
          return {
            objectId: relationshipId,
            relationshipId,
            action: 'created',
            after: { year: spend.year, amount_cents: spend.amountCents },
            result: undefined,
          };
        });
      }
      return { relationshipId, linked: supplier.existed };
    });
  }

  /** Stammdaten, eigene Werte, Status und Spend je Jahr eines Lieferanten. */
  async detail(auth: AuthContext, relationshipId: string): Promise<SupplierDetail> {
    const organization = this.reader(auth);
    return this.run(auth, organization, (tx) => readDetail(tx, relationshipId, auth));
  }

  /** Eigener Anzeigename, eigene Nummer und Notizen (relationship_side), mit internem Verlauf. */
  async update(
    auth: AuthContext,
    relationshipId: string,
    input: UpdateSupplierRequest,
  ): Promise<SupplierDetail> {
    const organization = this.editor(auth);
    const request = updateSupplierRequestSchema.parse(input);
    return this.run(auth, organization, async (tx) => {
      const actor = await actorOf(tx, auth, organization.id);
      await ownRelationship(tx, organization, relationshipId);
      await assertWritable(tx, auth, organization, relationshipId);
      const { relationshipSide } = schema;
      const [before] = await tx
        .select({
          display_name: relationshipSide.displayName,
          external_ref: relationshipSide.externalRef,
          notes: relationshipSide.notes,
        })
        .from(relationshipSide)
        .where(
          and(
            eq(relationshipSide.relationshipId, relationshipId),
            eq(relationshipSide.orgId, organization.id),
          ),
        );
      const after = {
        display_name: request.displayName,
        external_ref: request.externalRef ?? null,
        notes: request.notes ?? null,
      };
      await auditedChange(tx, actor, relationshipSideAudit, async () => {
        await tx
          .insert(relationshipSide)
          .values({
            relationshipId,
            orgId: organization.id,
            displayName: after.display_name,
            externalRef: after.external_ref,
            notes: after.notes,
          })
          .onConflictDoUpdate({
            target: [relationshipSide.relationshipId, relationshipSide.orgId],
            set: {
              displayName: after.display_name,
              externalRef: after.external_ref,
              notes: after.notes,
            },
          });
        return {
          objectId: relationshipId,
          relationshipId,
          action: before ? 'updated' : 'created',
          before: before ?? null,
          after,
          result: undefined,
        };
      });
      return readDetail(tx, relationshipId, auth);
    });
  }

  /** Beendet eine Beziehung; sie wird nie gelöscht (PLT-03). */
  async end(auth: AuthContext, relationshipId: string): Promise<SupplierDetail> {
    const organization = this.editor(auth);
    return this.run(auth, organization, async (tx) => {
      const actor = await actorOf(tx, auth, organization.id);
      const current = await ownRelationship(tx, organization, relationshipId);
      await assertWritable(tx, auth, organization, relationshipId);
      if (current.status === 'ended') {
        throw new ConflictException({
          statusCode: 409,
          code: 'schon_beendet',
          message: 'Diese Beziehung ist schon beendet.',
        });
      }
      await auditedChange(tx, actor, relationshipAudit, async () => {
        await tx
          .update(schema.relationship)
          .set({ status: 'ended', endedAt: new Date() })
          .where(eq(schema.relationship.id, relationshipId));
        return {
          objectId: relationshipId,
          relationshipId,
          action: 'ended',
          before: { status: current.status },
          after: { status: 'ended' },
          result: undefined,
        };
      });
      return readDetail(tx, relationshipId, auth);
    });
  }

  /** Spend eines Jahres anlegen oder ändern, in Cent, mit internem Verlauf. */
  async putSpend(
    auth: AuthContext,
    relationshipId: string,
    year: number,
    request: SpendRequest,
  ): Promise<SupplierDetail> {
    const organization = this.editor(auth);
    return this.run(auth, organization, async (tx) => {
      const actor = await actorOf(tx, auth, organization.id);
      await ownRelationship(tx, organization, relationshipId);
      await assertWritable(tx, auth, organization, relationshipId);
      const { relationshipSpend } = schema;
      const [before] = await tx
        .select({ amount_cents: relationshipSpend.amountCents })
        .from(relationshipSpend)
        .where(
          and(
            eq(relationshipSpend.relationshipId, relationshipId),
            eq(relationshipSpend.year, year),
          ),
        );
      await auditedChange(tx, actor, relationshipSpendAudit, async () => {
        await tx
          .insert(relationshipSpend)
          .values({ relationshipId, year, amountCents: request.amountCents, source: 'manual' })
          .onConflictDoUpdate({
            target: [relationshipSpend.relationshipId, relationshipSpend.year],
            set: { amountCents: request.amountCents, source: 'manual' },
          });
        return {
          objectId: relationshipId,
          relationshipId,
          action: before ? 'updated' : 'created',
          before: before ? { year, amount_cents: before.amount_cents } : null,
          after: { year, amount_cents: request.amountCents },
          result: undefined,
        };
      });
      return readDetail(tx, relationshipId, auth);
    });
  }
}

/** Die Beziehung als Käufer, sonst 404: Fremde Beziehungen gibt es aus Sicht dieser Session nicht. */
async function ownRelationship(
  tx: TenantTransaction,
  organization: AccountOrganization,
  relationshipId: string,
) {
  const { relationship } = schema;
  const [row] = await tx
    .select({ status: relationship.status })
    .from(relationship)
    .where(and(eq(relationship.id, relationshipId), eq(relationship.buyerOrgId, organization.id)));
  if (!row) throw notFound();
  return row;
}

const notFound = () =>
  new NotFoundException({
    statusCode: 404,
    code: 'nicht_gefunden',
    message: 'Lieferant nicht gefunden.',
  });

/** Teamrolle der Person an dieser Beziehung, oder null ohne Mitgliedschaft (PLT-05b). */
export async function teamRoleOf(
  tx: TenantTransaction,
  userId: string,
  relationshipId: string,
): Promise<TeamRole | null> {
  const [row] = await tx
    .select({ teamRole: schema.relationshipMember.teamRole })
    .from(schema.relationshipMember)
    .where(
      and(
        eq(schema.relationshipMember.relationshipId, relationshipId),
        eq(schema.relationshipMember.userId, userId),
      ),
    );
  return row?.teamRole ?? null;
}

/** Mit Teamrolle Leser ist die Beziehung für diese Person schreibgeschützt (PLT-05b). */
async function assertWritable(
  tx: TenantTransaction,
  auth: AuthContext,
  organization: AccountOrganization,
  relationshipId: string,
) {
  const teamRole = await teamRoleOf(tx, auth.userId, relationshipId);
  if (!organization.buyer || !can(auth, 'lieferanten.bearbeiten', { teamRole })) {
    throw forbidden('keine_berechtigung', 'Diese Beziehung ist für dich schreibgeschützt.');
  }
}

async function readDetail(
  tx: TenantTransaction,
  relationshipId: string,
  auth: AuthContext,
): Promise<SupplierDetail> {
  const { organization, relationship, relationshipSide, relationshipSpend } = schema;
  const [row] = await tx
    .select({
      relationshipId: relationship.id,
      name: sql<string>`coalesce(${relationshipSide.displayName}, ${organization.name})`,
      organizationName: organization.name,
      country: organization.country,
      vatId: organization.vatId,
      duns: organization.duns,
      externalRef: relationshipSide.externalRef,
      notes: relationshipSide.notes,
      isFocus: sql<boolean>`coalesce(${relationshipSide.isFocus}, false)`,
      status: relationship.status,
      createdAt: relationship.createdAt,
      endedAt: relationship.endedAt,
    })
    .from(relationship)
    .innerJoin(organization, eq(organization.id, relationship.supplierOrgId))
    .leftJoin(
      relationshipSide,
      and(
        eq(relationshipSide.relationshipId, relationship.id),
        eq(relationshipSide.orgId, relationship.buyerOrgId),
      ),
    )
    .where(eq(relationship.id, relationshipId));
  if (!row) throw notFound();
  const spend = await tx
    .select({
      year: relationshipSpend.year,
      amountCents: relationshipSpend.amountCents,
      currency: relationshipSpend.currency,
    })
    .from(relationshipSpend)
    .where(eq(relationshipSpend.relationshipId, relationshipId))
    .orderBy(desc(relationshipSpend.year));
  const teamRole = await teamRoleOf(tx, auth.userId, relationshipId);
  return {
    ...row,
    permissions: {
      edit: can(auth, 'lieferanten.bearbeiten', { teamRole }),
      editTeam: can(auth, 'team.festlegen'),
    },
    createdAt: row.createdAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    spend: spend.map(({ year, amountCents, currency }) => ({
      year,
      amount: { amountCents, currency },
    })),
  };
}

export interface SupplierFilter {
  name?: string | undefined;
  nummer?: string | undefined;
  land?: string | undefined;
  minSpendEuro?: number | undefined;
  maxSpendEuro?: number | undefined;
  businessUnit?: string | undefined;
  materialGroup?: string | undefined;
  year?: number | undefined;
  exactName?: boolean | undefined;
  sortierung?: 'spend_absteigend' | 'spend_aufsteigend' | 'name' | undefined;
  anzahl?: number | undefined;
}

/**
 * Liest die Lieferanten in einer Mandanten-Session. Gefiltert wird nur über Row-Level Security:
 * relationship_side und relationship_spend liefern nur die eigenen Zeilen (PLT-04). Ohne gesetzte
 * Organisation liefert die Abfrage nichts. Auch PLT-12 nutzt diese Funktion.
 */
export async function listSuppliers(
  tx: TenantTransaction,
  spendYear: number,
  userId?: string,
): Promise<Supplier[]> {
  const { organization, relationship, relationshipSide, relationshipSpend } = schema;
  const rows = await tx
    .select({
      relationshipId: relationship.id,
      name: sql<string>`coalesce(${relationshipSide.displayName}, ${organization.name})`,
      country: organization.country,
      externalRef: relationshipSide.externalRef,
      isFocus: sql<boolean>`coalesce(${relationshipSide.isFocus}, false)`,
      status: relationship.status,
      amountCents: relationshipSpend.amountCents,
      currency: relationshipSpend.currency,
      businessUnits: sql<string[]>`coalesce((
        select array_agg(b.name order by b.name)
        from relationship_business_unit rb
        join business_unit b on b.id = rb.business_unit_id
        where rb.relationship_id = ${relationship.id}
      ), '{}')`,
      // Warengruppen der Zuordnung (PLT-06), die Haupt-Warengruppe zuerst.
      materialGroups: sql<string[]>`coalesce((
        select array_agg(g.name order by rg.is_primary desc, g.name)
        from relationship_material_group rg join material_group g on g.id = rg.material_group_id
        where rg.relationship_id = ${relationship.id}
      ), '{}')`,
      businessUnitIds: sql<string[]>`coalesce((
        select array_agg(rb.business_unit_id::text)
        from relationship_business_unit rb where rb.relationship_id = ${relationship.id}
      ), '{}')`,
      materialGroupIds: sql<string[]>`coalesce((
        select array_agg(rg.material_group_id::text)
        from relationship_material_group rg where rg.relationship_id = ${relationship.id}
      ), '{}')`,
      targetType: sql<string | null>`(
        select sd.soll_impact_level || '-' || sd.soll_quality_level
        from segment_decision sd
        where sd.relationship_id = ${relationship.id} and sd.scope = 'total'
        order by sd.version desc limit 1
      )`,
      isMine: sql<boolean>`${
        userId
          ? sql`exists (
        select 1 from relationship_member rm
        where rm.relationship_id = ${relationship.id}
          and rm.org_id = ${relationship.buyerOrgId} and rm.user_id = ${userId}
      )`
          : sql`false`
      }`,
      hasPrimary: sql<boolean>`exists (
        select 1 from relationship_material_group rg
        where rg.relationship_id = ${relationship.id} and rg.is_primary
      )`,
    })
    .from(relationship)
    .innerJoin(organization, eq(organization.id, relationship.supplierOrgId))
    .leftJoin(
      relationshipSide,
      and(
        eq(relationshipSide.relationshipId, relationship.id),
        eq(relationshipSide.orgId, relationship.buyerOrgId),
      ),
    )
    .leftJoin(
      relationshipSpend,
      and(
        eq(relationshipSpend.relationshipId, relationship.id),
        eq(relationshipSpend.year, spendYear),
      ),
    )
    .orderBy(sql`${relationshipSpend.amountCents} desc nulls last`, organization.name);

  return rows.map(({ amountCents, currency, hasPrimary, ...supplier }) => ({
    ...supplier,
    spend: amountCents !== null && currency !== null ? { amountCents, currency } : null,
    primaryMaterialGroup: hasPrimary ? (supplier.materialGroups[0] ?? null) : null,
  }));
}

/** Auswahl für die Filter: aktive Business Units und Warengruppen, Soll-Typen des aktiven Modells. */
async function readFilters(
  tx: TenantTransaction,
): Promise<NonNullable<SuppliersResponse['filters']>> {
  const units = await tx
    .select({ id: schema.businessUnit.id, name: schema.businessUnit.name })
    .from(schema.businessUnit)
    .where(eq(schema.businessUnit.active, true))
    .orderBy(schema.businessUnit.name);
  const groups = await tx
    .select({
      id: schema.materialGroup.id,
      name: schema.materialGroup.name,
      parentId: schema.materialGroup.parentId,
    })
    .from(schema.materialGroup)
    .where(eq(schema.materialGroup.active, true))
    .orderBy(schema.materialGroup.name);
  const types = await tx
    .select({
      impact: schema.segmentType.impactLevel,
      quality: schema.segmentType.qualityLevel,
      name: schema.segmentType.name,
    })
    .from(schema.segmentType)
    .innerJoin(schema.segmentModel, eq(schema.segmentModel.id, schema.segmentType.modelId))
    .where(eq(schema.segmentModel.status, 'active'))
    .orderBy(desc(schema.segmentType.impactLevel), desc(schema.segmentType.qualityLevel));
  return {
    businessUnits: units,
    materialGroups: groups,
    targetTypes: types.map((type) => ({ key: `${type.impact}-${type.quality}`, name: type.name })),
  };
}

function totalByCurrency(suppliers: Supplier[]): Money[] {
  const totals = new Map<string, number>();
  for (const { spend } of suppliers) {
    if (!spend) continue;
    totals.set(spend.currency, (totals.get(spend.currency) ?? 0) + spend.amountCents);
  }
  return [...totals].map(([currency, amountCents]) => ({ amountCents, currency }));
}
