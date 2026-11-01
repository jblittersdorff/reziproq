import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, auditedChange, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import type {
  AssignmentRequest,
  AssignmentResponse,
  BusinessUnit,
  BusinessUnitRequest,
  MasterDataError,
  MaterialGroup,
  MaterialGroupRequest,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { relationshipAssignmentAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { teamRoleOf } from '../suppliers/suppliers.service.js';
import { ownRelationship } from '../suppliers/team.service.js';

export type EntryKind = 'business_unit' | 'material_group';

const conflict = (code: MasterDataError, message: string) =>
  new ConflictException({ statusCode: 409, code, message });

const notFound = () =>
  new NotFoundException({ statusCode: 404, code: 'nicht_gefunden', message: 'Nicht gefunden.' });

/**
 * Übersetzt Fehler der Datenbank in Codes (PLT-06): Codes je Organisation eindeutig (23505),
 * benutzte Einträge (23503) und die Prüfungen der Trigger, deren Meldung mit dem Code beginnt.
 */
function translate(error: unknown): never {
  type DbError = { code?: string; message?: string; constraint?: string };
  // Fehler beim Commit (aufgeschobene Prüfung) kommen ohne Hülle von drizzle.
  const cause: DbError | undefined =
    (error as { cause?: DbError }).cause ?? (error as DbError | undefined);
  if (cause?.code === '23505' && /_code$/.test(cause.constraint ?? '')) {
    throw conflict('code_taken', 'Diesen Code gibt es in deiner Organisation schon.');
  }
  if (cause?.code === '23503') {
    throw conflict('in_use', 'Der Eintrag ist zugeordnet; deaktiviere ihn stattdessen.');
  }
  const code = (cause?.message ?? '').split(':')[0] as MasterDataError;
  if (['too_deep', 'inactive', 'primary_required', 'foreign_entry'].includes(code)) {
    throw conflict(code, cause?.message ?? code);
  }
  throw error;
}

/** Business Units und Warengruppen je Organisation und ihre Zuordnung zu Lieferanten (PLT-06). */
@Injectable()
export class MasterDataService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private organization(auth: AuthContext): AccountOrganization {
    const organization = auth.organization;
    if (!organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return organization;
  }

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, org: AccountOrganization) => Promise<T>,
  ) {
    const organization = this.organization(auth);
    return this.tenant
      .run({ userId: auth.userId, organizationId: organization.id }, (tx) => work(tx, organization))
      .catch(translate);
  }

  businessUnits(auth: AuthContext): Promise<BusinessUnit[]> {
    return this.run(auth, (tx) => readBusinessUnits(tx));
  }

  materialGroups(auth: AuthContext): Promise<MaterialGroup[]> {
    return this.run(auth, (tx) => readMaterialGroups(tx));
  }

  async businessUnit(auth: AuthContext, id: string): Promise<BusinessUnit> {
    const found = (await this.businessUnits(auth)).find((entry) => entry.id === id);
    if (!found) throw notFound();
    return found;
  }

  async materialGroup(auth: AuthContext, id: string): Promise<MaterialGroup> {
    const found = (await this.materialGroups(auth)).find((entry) => entry.id === id);
    if (!found) throw notFound();
    return found;
  }

  async createBusinessUnit(auth: AuthContext, input: BusinessUnitRequest): Promise<BusinessUnit> {
    const id = await this.run(auth, async (tx, org) => {
      const [row] = await tx
        .insert(schema.businessUnit)
        .values({ orgId: org.id, name: input.name, code: input.code, active: input.active ?? true })
        .returning({ id: schema.businessUnit.id });
      return row?.id as string;
    });
    return this.businessUnit(auth, id);
  }

  async createMaterialGroup(
    auth: AuthContext,
    input: MaterialGroupRequest,
  ): Promise<MaterialGroup> {
    const id = await this.run(auth, async (tx, org) => {
      const [row] = await tx
        .insert(schema.materialGroup)
        .values({
          orgId: org.id,
          name: input.name,
          code: input.code,
          parentId: input.parentId ?? null,
          active: input.active ?? true,
        })
        .returning({ id: schema.materialGroup.id });
      return row?.id as string;
    });
    return this.materialGroup(auth, id);
  }

  async updateBusinessUnit(auth: AuthContext, id: string, input: BusinessUnitRequest) {
    await this.run(auth, async (tx) => {
      const updated = await tx
        .update(schema.businessUnit)
        .set({
          name: input.name,
          code: input.code,
          ...(input.active === undefined ? {} : { active: input.active }),
        })
        .where(eq(schema.businessUnit.id, id))
        .returning({ id: schema.businessUnit.id });
      if (updated.length === 0) throw notFound();
    });
    return this.businessUnit(auth, id);
  }

  async updateMaterialGroup(auth: AuthContext, id: string, input: MaterialGroupRequest) {
    await this.run(auth, async (tx) => {
      const updated = await tx
        .update(schema.materialGroup)
        .set({
          name: input.name,
          code: input.code,
          parentId: input.parentId ?? null,
          ...(input.active === undefined ? {} : { active: input.active }),
        })
        .where(eq(schema.materialGroup.id, id))
        .returning({ id: schema.materialGroup.id });
      if (updated.length === 0) throw notFound();
    });
    return this.materialGroup(auth, id);
  }

  /** Nur unbenutzte Einträge; benutzte sperrt die Datenbank (409 in_use). */
  async remove(auth: AuthContext, kind: EntryKind, id: string): Promise<void> {
    await this.run(auth, async (tx) => {
      const table = kind === 'business_unit' ? schema.businessUnit : schema.materialGroup;
      const deleted = await tx.delete(table).where(eq(table.id, id)).returning({ id: table.id });
      if (deleted.length === 0) throw notFound();
    });
  }

  assignment(auth: AuthContext, relationshipId: string): Promise<AssignmentResponse> {
    return this.run(auth, async (tx, org) => {
      await ownRelationship(tx, org, relationshipId);
      const teamRole = await teamRoleOf(tx, auth.userId, relationshipId);
      return {
        ...(await readAssignment(tx, relationshipId)),
        canEdit: can(auth, 'zuordnung.bearbeiten', { teamRole }),
      };
    });
  }

  /**
   * Setzt die Zuordnung auf einmal. Bestehende Zeilen bleiben, damit deaktivierte Einträge
   * zugeordnet bleiben können; neue prüft die Datenbank (eigene, aktive Einträge).
   */
  setAssignment(
    auth: AuthContext,
    relationshipId: string,
    input: AssignmentRequest,
  ): Promise<AssignmentResponse> {
    return this.run(auth, async (tx, org) => {
      await ownRelationship(tx, org, relationshipId);
      const teamRole = await teamRoleOf(tx, auth.userId, relationshipId);
      if (!can(auth, 'zuordnung.bearbeiten', { teamRole })) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'keine_berechtigung',
          message: 'Diese Beziehung ist für dich schreibgeschützt.',
        });
      }
      const before = await readAssignment(tx, relationshipId);
      const actor = await actorOf(tx, auth, org.id);
      await auditedChange(tx, actor, relationshipAssignmentAudit, async () => {
        const { relationshipBusinessUnit: rbu, relationshipMaterialGroup: rmg } = schema;
        const units = new Set(input.businessUnitIds);
        const groups = new Set(input.materialGroupIds);
        for (const entry of before.businessUnits.filter((unit) => !units.has(unit.id))) {
          await tx
            .delete(rbu)
            .where(and(eq(rbu.relationshipId, relationshipId), eq(rbu.businessUnitId, entry.id)));
        }
        for (const unitId of units) {
          if (!before.businessUnits.some((unit) => unit.id === unitId)) {
            await tx.insert(rbu).values({ relationshipId, businessUnitId: unitId });
          }
        }
        for (const entry of before.materialGroups.filter((group) => !groups.has(group.id))) {
          await tx
            .delete(rmg)
            .where(and(eq(rmg.relationshipId, relationshipId), eq(rmg.materialGroupId, entry.id)));
        }
        // Erst alle Haupt-Markierungen lösen; die eine prüft die Datenbank am Ende der Transaktion.
        await tx
          .update(rmg)
          .set({ isPrimary: false })
          .where(eq(rmg.relationshipId, relationshipId));
        for (const groupId of groups) {
          const isPrimary = groupId === input.primaryMaterialGroupId;
          if (before.materialGroups.some((group) => group.id === groupId)) {
            if (isPrimary) {
              await tx
                .update(rmg)
                .set({ isPrimary: true })
                .where(
                  and(eq(rmg.relationshipId, relationshipId), eq(rmg.materialGroupId, groupId)),
                );
            }
          } else {
            await tx.insert(rmg).values({ relationshipId, materialGroupId: groupId, isPrimary });
          }
        }
        const after = await readAssignment(tx, relationshipId);
        return {
          objectId: relationshipId,
          relationshipId,
          action: 'updated',
          before: summary(before),
          after: summary(after),
          result: undefined,
        };
      });
      return {
        ...(await readAssignment(tx, relationshipId)),
        canEdit: true,
      };
    });
  }
}

/** Verlauf in Namen, nicht in IDs; die Haupt-Warengruppe als eigenes Feld. */
function summary(value: Omit<AssignmentResponse, 'canEdit'>) {
  return {
    business_units: value.businessUnits.map((unit) => ({ name: unit.name })),
    material_groups: value.materialGroups.map((group) => ({ name: group.name })),
    primary_material_group: value.materialGroups.find((group) => group.isPrimary)?.name ?? null,
  };
}

async function readBusinessUnits(tx: TenantTransaction): Promise<BusinessUnit[]> {
  const result = await tx.execute<BusinessUnit>(sql`
    select u.id, u.name, u.code, u.active,
      (select count(*)::int from relationship_business_unit r where r.business_unit_id = u.id)
        as "supplierCount"
    from business_unit u
    order by u.active desc, lower(u.name)
  `);
  return result.rows;
}

async function readMaterialGroups(tx: TenantTransaction): Promise<MaterialGroup[]> {
  const result = await tx.execute<MaterialGroup>(sql`
    select g.id, g.name, g.code, g.active, g.parent_id as "parentId",
      (select count(*)::int from relationship_material_group r where r.material_group_id = g.id)
        as "supplierCount",
      (select count(*)::int from material_group c where c.parent_id = g.id) as "childCount"
    from material_group g
    left join material_group p on p.id = g.parent_id
    order by lower(coalesce(p.name, g.name)), g.parent_id is not null, lower(g.name)
  `);
  return result.rows;
}

async function readAssignment(
  tx: TenantTransaction,
  relationshipId: string,
): Promise<Omit<AssignmentResponse, 'canEdit'>> {
  const units = await tx.execute<AssignmentResponse['businessUnits'][number]>(sql`
    select u.id, u.name, u.code, u.active
    from relationship_business_unit r join business_unit u on u.id = r.business_unit_id
    where r.relationship_id = ${relationshipId}
    order by lower(u.name)
  `);
  const groups = await tx.execute<AssignmentResponse['materialGroups'][number]>(sql`
    select g.id, g.name, g.code, g.active, r.is_primary as "isPrimary"
    from relationship_material_group r join material_group g on g.id = r.material_group_id
    where r.relationship_id = ${relationshipId}
    order by r.is_primary desc, lower(g.name)
  `);
  return { businessUnits: units.rows, materialGroups: groups.rows };
}
