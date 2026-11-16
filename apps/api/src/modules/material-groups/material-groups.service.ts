import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  auditedObject,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type CategoryLabel,
  type MaterialGroupDetail,
  type MaterialGroupImportError,
  type MaterialGroupImportPreview,
  type MaterialGroupOverview,
  type MergeMaterialGroup,
  materialGroupDetailSchema,
  materialGroupOverviewSchema,
  type ProductGroupRequest,
  productGroupRequestSchema,
  type SplitMaterialGroup,
  type TeamRequest,
  teamRequestSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import type { ParsedImportFile } from '../suppliers/import-file.js';
import { readCategoryLabel } from './category-label.js';
import { syncLeadership } from './leadership.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string, message: string) =>
  new ConflictException({ statusCode: 409, code, message });

/** Verlauf: Zusammenlegen und Teilen mit der Antwort auf die Rückfrage; Bezeichnung. */
export const materialGroupAudit = auditedObject({
  type: 'material_group',
  visibility: 'internal',
  fields: ['merged_into', 'split_into', 'spend', 'active', 'label_singular', 'label_plural'],
});

const codePattern = /^[\p{L}\p{N}._-]{1,20}$/u;

type GroupRow = typeof schema.materialGroup.$inferSelect;

/** Spaltennamen der Importdatei, Deutsch oder Englisch, ohne Groß und klein */
const importColumns = {
  code: ['kennung', 'code'],
  name: ['name'],
  parent: ['übergeordnete kennung', 'uebergeordnete kennung', 'parent code', 'parent'],
  lead: ['lead (e-mail)', 'lead', 'lead e-mail', 'lead email'],
} as const;

function column(file: ParsedImportFile, names: readonly string[]) {
  return file.headers.find((header) => names.includes(header.trim().toLocaleLowerCase('de')));
}

/**
 * WG-01: Warengruppen mit Lead, Team und Produktgruppen, eigener Bezeichnung, Import, Zusammenlegen
 * und Teilen. Anlegen, Umbenennen und Deaktivieren laufen weiter über die Stammdaten (PLT-06).
 */
@Injectable()
export class MaterialGroupsService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private organization(auth: AuthContext): AccountOrganization {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return organization;
  }

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, org: AccountOrganization) => Promise<T>,
    options: { readOnly?: boolean } = {},
  ) {
    const organization = this.organization(auth);
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      (tx) => work(tx, organization),
      options,
    );
  }

  private isAdmin(auth: AuthContext) {
    return can(auth, 'stammdaten.verwalten');
  }

  private requireAdmin(auth: AuthContext) {
    if (!this.isAdmin(auth)) throw forbidden();
  }

  private async group(tx: TenantTransaction, id: string): Promise<GroupRow> {
    const [row] = await tx
      .select()
      .from(schema.materialGroup)
      .where(eq(schema.materialGroup.id, id));
    if (!row) throw notFound();
    return row;
  }

  /** Admin oder Lead der Warengruppe (Feld oder Teamrolle „lead“) */
  private async canEdit(tx: TenantTransaction, auth: AuthContext, group: GroupRow) {
    if (this.isAdmin(auth)) return true;
    if (!can(auth, 'warengruppen.team')) return false;
    if (group.leadUserId === auth.userId) return true;
    const [lead] = await tx
      .select({ id: schema.materialGroupMember.id })
      .from(schema.materialGroupMember)
      .where(
        and(
          eq(schema.materialGroupMember.materialGroupId, group.id),
          eq(schema.materialGroupMember.userId, auth.userId),
          eq(schema.materialGroupMember.role, 'lead'),
        ),
      );
    return lead !== undefined;
  }

  overview(auth: AuthContext): Promise<MaterialGroupOverview> {
    return this.run(
      auth,
      async (tx, org) => {
        const groups = await tx.execute<Record<string, unknown>>(sql`
          select g.id, g.name, g.code, g.parent_id, g.active, g.lead_user_id, u.name as lead_name,
            (select count(*)::int from material_group_product_group p where p.material_group_id = g.id)
              as product_groups,
            (select count(*)::int from material_group_member m where m.material_group_id = g.id)
              as members,
            (select count(*)::int from relationship_material_group r where r.material_group_id = g.id)
              as suppliers
          from material_group g
          left join app_user u on u.id = g.lead_user_id
          order by coalesce((select p.name from material_group p where p.id = g.parent_id), g.name),
            g.parent_id nulls first, g.name
        `);
        const [unassigned] = (
          await tx.execute<{ n: number }>(sql`
            select count(*)::int as n from relationship_spend s
            join relationship r on r.id = s.relationship_id
            where r.buyer_org_id = ${org.id} and s.material_group_id is null
          `)
        ).rows;
        return materialGroupOverviewSchema.parse({
          label: await readCategoryLabel(tx, org.id),
          canManage: this.isAdmin(auth),
          unassignedSpendRows: unassigned?.n ?? 0,
          groups: groups.rows.map((row) => ({
            id: row.id,
            name: row.name,
            code: row.code,
            parentId: row.parent_id,
            active: row.active,
            lead: row.lead_user_id
              ? { userId: row.lead_user_id, name: row.lead_name ?? row.lead_user_id }
              : null,
            productGroupCount: row.product_groups,
            memberCount: row.members,
            supplierCount: row.suppliers,
          })),
        });
      },
      { readOnly: true },
    );
  }

  private async detailIn(
    tx: TenantTransaction,
    auth: AuthContext,
    org: AccountOrganization,
    id: string,
  ): Promise<MaterialGroupDetail> {
    const group = await this.group(tx, id);
    const people = await tx
      .select({ userId: schema.appUser.id, name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.organizationId, org.id))
      .orderBy(asc(schema.appUser.name));
    const nameOf = (userId: string | null) =>
      userId ? { userId, name: people.find((p) => p.userId === userId)?.name ?? userId } : null;
    const parent = group.parentId ? await this.group(tx, group.parentId) : null;
    const children = await tx
      .select({
        id: schema.materialGroup.id,
        name: schema.materialGroup.name,
        code: schema.materialGroup.code,
        active: schema.materialGroup.active,
      })
      .from(schema.materialGroup)
      .where(eq(schema.materialGroup.parentId, id))
      .orderBy(asc(schema.materialGroup.name));
    const productGroups = await tx
      .select({
        id: schema.materialGroupProductGroup.id,
        name: schema.materialGroupProductGroup.name,
        description: schema.materialGroupProductGroup.description,
        position: schema.materialGroupProductGroup.position,
      })
      .from(schema.materialGroupProductGroup)
      .where(eq(schema.materialGroupProductGroup.materialGroupId, id))
      .orderBy(
        asc(schema.materialGroupProductGroup.position),
        asc(schema.materialGroupProductGroup.name),
      );
    const members = await tx
      .select({
        id: schema.materialGroupMember.id,
        userId: schema.materialGroupMember.userId,
        role: schema.materialGroupMember.role,
        businessUnitId: schema.materialGroupMember.businessUnitId,
        businessUnitName: schema.businessUnit.name,
        region: schema.materialGroupMember.region,
        task: schema.materialGroupMember.task,
      })
      .from(schema.materialGroupMember)
      .leftJoin(
        schema.businessUnit,
        eq(schema.businessUnit.id, schema.materialGroupMember.businessUnitId),
      )
      .where(eq(schema.materialGroupMember.materialGroupId, id));
    const roleOrder = ['lead', 'commodity_manager', 'buyer', 'function'];
    const suppliers = await tx.execute<{
      relationship_id: string;
      name: string;
      source: 'spend' | 'manual';
      is_primary: boolean;
    }>(sql`
      select a.relationship_id, coalesce(rs.display_name, o.name) as name, a.source, a.is_primary
      from relationship_material_group a
      join relationship r on r.id = a.relationship_id
      join organization o on o.id = r.supplier_org_id
      left join relationship_side rs on rs.relationship_id = r.id and rs.org_id = r.buyer_org_id
      where a.material_group_id = ${id}
      order by name
    `);
    const units = await tx
      .select({ id: schema.businessUnit.id, name: schema.businessUnit.name })
      .from(schema.businessUnit)
      .where(eq(schema.businessUnit.active, true))
      .orderBy(asc(schema.businessUnit.name));
    return materialGroupDetailSchema.parse({
      label: await readCategoryLabel(tx, org.id),
      group: {
        id: group.id,
        name: group.name,
        code: group.code,
        description: group.description,
        active: group.active,
        lead: nameOf(group.leadUserId),
        commodityManager: nameOf(group.commodityManagerUserId),
      },
      parent: parent && { id: parent.id, name: parent.name },
      children,
      productGroups,
      members: members
        .sort(
          (a, b) =>
            roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) ||
            (nameOf(a.userId)?.name ?? '').localeCompare(nameOf(b.userId)?.name ?? ''),
        )
        .map((member) => ({
          id: member.id,
          userId: member.userId,
          name: nameOf(member.userId)?.name ?? member.userId,
          role: member.role,
          businessUnit:
            member.businessUnitId && member.businessUnitName
              ? { id: member.businessUnitId, name: member.businessUnitName }
              : null,
          region: member.region,
          task: member.task,
        })),
      suppliers: suppliers.rows.map((row) => ({
        relationshipId: row.relationship_id,
        name: row.name,
        source: row.source,
        isPrimary: row.is_primary,
      })),
      canEdit: await this.canEdit(tx, auth, group),
      people,
      businessUnits: units,
    });
  }

  detail(auth: AuthContext, id: string): Promise<MaterialGroupDetail> {
    return this.run(auth, (tx, org) => this.detailIn(tx, auth, org, id), { readOnly: true });
  }

  /** Lead oder Admin pflegen Team und Produktgruppen. */
  private async editable(tx: TenantTransaction, auth: AuthContext, id: string) {
    const group = await this.group(tx, id);
    if (!(await this.canEdit(tx, auth, group))) throw forbidden();
    return group;
  }

  saveTeam(auth: AuthContext, id: string, input: TeamRequest) {
    const parsed = teamRequestSchema.parse(input);
    return this.run(auth, async (tx, org) => {
      await this.editable(tx, auth, id);
      await tx
        .delete(schema.materialGroupMember)
        .where(
          and(
            eq(schema.materialGroupMember.materialGroupId, id),
            inArray(schema.materialGroupMember.role, ['buyer', 'function']),
          ),
        );
      if (parsed.members.length > 0) {
        await tx
          .insert(schema.materialGroupMember)
          .values(
            parsed.members.map((member) => ({
              orgId: org.id,
              materialGroupId: id,
              userId: member.userId,
              role: member.role,
              businessUnitId: member.businessUnitId ?? null,
              region: member.region,
              task: member.task,
            })),
          )
          .onConflictDoNothing();
      }
      return this.detailIn(tx, auth, org, id);
    }).catch(translateTeamError);
  }

  createProductGroup(auth: AuthContext, id: string, input: ProductGroupRequest) {
    const parsed = productGroupRequestSchema.parse(input);
    return this.run(auth, async (tx, org) => {
      await this.editable(tx, auth, id);
      const [last] = await tx
        .select({
          position: sql<number>`coalesce(max(${schema.materialGroupProductGroup.position}), 0)::int`,
        })
        .from(schema.materialGroupProductGroup)
        .where(eq(schema.materialGroupProductGroup.materialGroupId, id));
      await tx.insert(schema.materialGroupProductGroup).values({
        orgId: org.id,
        materialGroupId: id,
        name: parsed.name,
        description: parsed.description,
        position: (last?.position ?? 0) + 1,
      });
      return this.detailIn(tx, auth, org, id);
    }).catch(translateProductGroupError);
  }

  updateProductGroup(
    auth: AuthContext,
    id: string,
    productGroupId: string,
    input: ProductGroupRequest,
  ) {
    const parsed = productGroupRequestSchema.parse(input);
    return this.run(auth, async (tx, org) => {
      await this.editable(tx, auth, id);
      const updated = await tx
        .update(schema.materialGroupProductGroup)
        .set({ name: parsed.name, description: parsed.description })
        .where(
          and(
            eq(schema.materialGroupProductGroup.id, productGroupId),
            eq(schema.materialGroupProductGroup.materialGroupId, id),
          ),
        )
        .returning({ id: schema.materialGroupProductGroup.id });
      if (updated.length === 0) throw notFound();
      return this.detailIn(tx, auth, org, id);
    }).catch(translateProductGroupError);
  }

  /** Nur ohne Spend; sonst 409 in_use. */
  removeProductGroup(auth: AuthContext, id: string, productGroupId: string) {
    return this.run(auth, async (tx, org) => {
      await this.editable(tx, auth, id);
      const deleted = await tx
        .delete(schema.materialGroupProductGroup)
        .where(
          and(
            eq(schema.materialGroupProductGroup.id, productGroupId),
            eq(schema.materialGroupProductGroup.materialGroupId, id),
          ),
        )
        .returning({ id: schema.materialGroupProductGroup.id });
      if (deleted.length === 0) throw notFound();
      return this.detailIn(tx, auth, org, id);
    }).catch(translateProductGroupError);
  }

  label(auth: AuthContext): Promise<CategoryLabel> {
    return this.run(auth, (tx, org) => readCategoryLabel(tx, org.id), { readOnly: true });
  }

  saveLabel(auth: AuthContext, input: CategoryLabel): Promise<CategoryLabel> {
    this.requireAdmin(auth);
    return this.run(auth, async (tx, org) => {
      const before = await readCategoryLabel(tx, org.id);
      const actor = await actorOf(tx, auth, org.id);
      await auditedChange(tx, actor, materialGroupAudit, async () => {
        for (const [key, value] of [
          ['category_label_singular', input.singular],
          ['category_label_plural', input.plural],
        ] as const) {
          await tx
            .insert(schema.orgSetting)
            .values({ orgId: org.id, key, value, updatedBy: auth.userId })
            .onConflictDoUpdate({
              target: [schema.orgSetting.orgId, schema.orgSetting.key],
              set: { value, updatedBy: auth.userId, updatedAt: new Date() },
            });
        }
        return {
          objectId: org.id,
          relationshipId: null,
          action: 'updated' as const,
          before: { label_singular: before.singular, label_plural: before.plural },
          after: { label_singular: input.singular, label_plural: input.plural },
          result: null,
        };
      });
      return readCategoryLabel(tx, org.id);
    });
  }

  /** Vorschau des Imports; validiert alle Zeilen, schreibt nichts. */
  private async validateImport(
    tx: TenantTransaction,
    org: AccountOrganization,
    file: ParsedImportFile,
  ): Promise<MaterialGroupImportPreview> {
    const columns = {
      code: column(file, importColumns.code),
      name: column(file, importColumns.name),
      parent: column(file, importColumns.parent),
      lead: column(file, importColumns.lead),
    };
    if (!columns.code || !columns.name) {
      throw new BadRequestException({
        code: 'missing_columns',
        message: 'Die Datei braucht die Spalten Kennung und Name.',
      });
    }
    const existing = await tx
      .select({ code: schema.materialGroup.code, parentId: schema.materialGroup.parentId })
      .from(schema.materialGroup);
    const existingCodes = new Map(
      existing.map((row) => [row.code.toLocaleLowerCase('de'), row.parentId]),
    );
    const people = await tx
      .select({ email: schema.appUser.email })
      .from(schema.appUser)
      .where(eq(schema.appUser.organizationId, org.id));
    const emails = new Set(people.map((person) => person.email.toLocaleLowerCase('de')));
    const value = (row: { values: Record<string, string> }, name: string | undefined) =>
      name ? (row.values[name] ?? '').trim() : '';
    const parsed = file.rows.map((row) => ({
      row: row.row,
      code: value(row, columns.code),
      name: value(row, columns.name),
      parentCode: value(row, columns.parent) || null,
      leadEmail: value(row, columns.lead) || null,
    }));
    const inFile = new Map<string, number>();
    for (const row of parsed) {
      const key = row.code.toLocaleLowerCase('de');
      inFile.set(key, (inFile.get(key) ?? 0) + 1);
    }
    const rows = parsed.map((row) => {
      const errors: MaterialGroupImportError[] = [];
      const key = row.code.toLocaleLowerCase('de');
      if (!row.code) errors.push('code_missing');
      else if (!codePattern.test(row.code)) errors.push('code_invalid');
      if (!row.name) errors.push('name_missing');
      if (row.code && (inFile.get(key) ?? 0) > 1) errors.push('code_duplicate');
      if (row.code && existingCodes.has(key)) errors.push('code_taken');
      if (row.parentCode) {
        const parentKey = row.parentCode.toLocaleLowerCase('de');
        const parentInFile = parsed.find(
          (entry) => entry.code.toLocaleLowerCase('de') === parentKey,
        );
        if (parentInFile) {
          if (parentInFile.parentCode) errors.push('too_deep');
        } else if (existingCodes.has(parentKey)) {
          if (existingCodes.get(parentKey) !== null) errors.push('too_deep');
        } else {
          errors.push('parent_unknown');
        }
      }
      if (row.leadEmail && !emails.has(row.leadEmail.toLocaleLowerCase('de'))) {
        errors.push('lead_unknown');
      }
      return { ...row, errors };
    });
    return { rows, valid: rows.length > 0 && rows.every((row) => row.errors.length === 0) };
  }

  importPreview(auth: AuthContext, file: ParsedImportFile) {
    this.requireAdmin(auth);
    return this.run(auth, (tx, org) => this.validateImport(tx, org, file), { readOnly: true });
  }

  /** Übernimmt alles oder nichts: bei einem Fehler in der Vorschau wird nichts angelegt. */
  importCommit(auth: AuthContext, file: ParsedImportFile) {
    this.requireAdmin(auth);
    return this.run(auth, async (tx, org) => {
      const preview = await this.validateImport(tx, org, file);
      if (!preview.valid) {
        throw new BadRequestException({ code: 'import_invalid', preview });
      }
      const people = await tx
        .select({ id: schema.appUser.id, email: schema.appUser.email })
        .from(schema.appUser)
        .where(eq(schema.appUser.organizationId, org.id));
      const userOf = (email: string | null) =>
        email
          ? (people.find((p) => p.email.toLocaleLowerCase('de') === email.toLocaleLowerCase('de'))
              ?.id ?? null)
          : null;
      const ids = new Map<string, string>();
      for (const row of await tx
        .select({ id: schema.materialGroup.id, code: schema.materialGroup.code })
        .from(schema.materialGroup)) {
        ids.set(row.code.toLocaleLowerCase('de'), row.id);
      }
      // Oberebenen zuerst, dann ihre Untergruppen.
      const ordered = [
        ...preview.rows.filter((row) => !row.parentCode),
        ...preview.rows.filter((row) => row.parentCode),
      ];
      for (const row of ordered) {
        const leadUserId = userOf(row.leadEmail);
        const [created] = await tx
          .insert(schema.materialGroup)
          .values({
            orgId: org.id,
            code: row.code,
            name: row.name,
            parentId: row.parentCode
              ? (ids.get(row.parentCode.toLocaleLowerCase('de')) ?? null)
              : null,
            leadUserId,
          })
          .returning({ id: schema.materialGroup.id });
        const id = created?.id as string;
        ids.set(row.code.toLocaleLowerCase('de'), id);
        await syncLeadership(tx, org.id, id, leadUserId, null);
      }
      return { created: ordered.length };
    });
  }

  /**
   * Verschiebt Spend-Zeilen auf eine andere Warengruppe (oder ohne Warengruppe). Gibt es für
   * Beziehung, Jahr, Art und Business Unit dort schon eine Zeile, werden die Beträge addiert.
   */
  private async moveSpend(
    tx: TenantTransaction,
    where: ReturnType<typeof sql>,
    targetId: string | null,
  ) {
    await tx.execute(sql`
      insert into relationship_spend
        (relationship_id, year, amount_cents, currency, source, kind, business_unit_id, material_group_id, product_group_id)
      select s.relationship_id, s.year, s.amount_cents, s.currency, s.source, s.kind, s.business_unit_id,
        ${targetId}::uuid, case when ${targetId}::uuid is null then null else s.product_group_id end
      from relationship_spend s where ${where}
      on conflict on constraint relationship_spend_je_eintrag
        do update set amount_cents = relationship_spend.amount_cents + excluded.amount_cents
    `);
    await tx.execute(sql`delete from relationship_spend s where ${where}`);
  }

  /** Zusammenlegen: Spend, Lieferanten, Produktgruppen und Team gehen in die Ziel-Warengruppe. */
  merge(auth: AuthContext, id: string, input: MergeMaterialGroup) {
    this.requireAdmin(auth);
    return this.run(auth, async (tx, org) => {
      const source = await this.group(tx, id);
      const target = await this.group(tx, input.targetId);
      if (source.id === target.id) throw conflict('same_group', 'Ziel und Quelle sind gleich.');
      if (!target.active) throw conflict('inactive', 'Die Ziel-Warengruppe ist deaktiviert.');
      const [child] = await tx
        .select({ id: schema.materialGroup.id })
        .from(schema.materialGroup)
        .where(eq(schema.materialGroup.parentId, source.id))
        .limit(1);
      if (child || target.parentId === source.id) {
        throw conflict('has_children', 'Erst die Untergruppen zusammenlegen oder verschieben.');
      }
      const actor = await actorOf(tx, auth, org.id);
      await auditedChange(tx, actor, materialGroupAudit, async () => {
        // Produktgruppen ziehen um; bei gleichem Namen bekommen sie die alte Kennung dazu.
        await tx.execute(sql`
          update material_group_product_group p
          set material_group_id = ${target.id},
            name = case when exists (
              select 1 from material_group_product_group t
              where t.material_group_id = ${target.id} and lower(t.name) = lower(p.name)
            ) then p.name || ' (' || ${source.code} || ')' else p.name end
          where p.material_group_id = ${source.id}
        `);
        // Spend: verschieben oder ohne Warengruppe; die Produktgruppen sind schon beim Ziel.
        await this.moveSpend(
          tx,
          sql`s.material_group_id = ${source.id}`,
          input.spend === 'move' ? target.id : null,
        );
        // Lieferanten: Zuordnung zum Ziel, die Haupt-Warengruppe bleibt Haupt-Warengruppe.
        await tx.execute(sql`
          update relationship_material_group t set is_primary = true
          from relationship_material_group s
          where s.material_group_id = ${source.id} and s.is_primary
            and t.relationship_id = s.relationship_id and t.material_group_id = ${target.id}
        `);
        await tx.execute(sql`
          delete from relationship_material_group s
          where s.material_group_id = ${source.id} and exists (
            select 1 from relationship_material_group t
            where t.relationship_id = s.relationship_id and t.material_group_id = ${target.id}
          )
        `);
        await tx.execute(sql`
          update relationship_material_group set material_group_id = ${target.id}
          where material_group_id = ${source.id}
        `);
        // Team: wer noch nicht im Ziel ist, kommt dazu (ohne Lead und Commodity Manager).
        await tx.execute(sql`
          update material_group_member m set material_group_id = ${target.id}
          where m.material_group_id = ${source.id} and m.role in ('buyer', 'function')
            and not exists (
              select 1 from material_group_member t
              where t.material_group_id = ${target.id} and t.user_id = m.user_id and t.role = m.role
            )
        `);
        await tx
          .delete(schema.materialGroupMember)
          .where(eq(schema.materialGroupMember.materialGroupId, source.id));
        await tx
          .update(schema.materialGroup)
          .set({ active: false, leadUserId: null, commodityManagerUserId: null })
          .where(eq(schema.materialGroup.id, source.id));
        return {
          objectId: source.id,
          relationshipId: null,
          action: 'updated' as const,
          before: { active: true, merged_into: null, spend: null },
          after: { active: false, merged_into: target.code, spend: input.spend },
          result: null,
        };
      });
      return this.detailIn(tx, auth, org, target.id);
    }).catch(translateMasterError);
  }

  /** Teilen: neue Warengruppen auf derselben Ebene, Produktgruppen und ggf. ihr Spend ziehen mit. */
  split(auth: AuthContext, id: string, input: SplitMaterialGroup) {
    this.requireAdmin(auth);
    return this.run(auth, async (tx, org) => {
      const source = await this.group(tx, id);
      if (!source.active) throw conflict('inactive', 'Die Warengruppe ist deaktiviert.');
      const own = await tx
        .select({ id: schema.materialGroupProductGroup.id })
        .from(schema.materialGroupProductGroup)
        .where(eq(schema.materialGroupProductGroup.materialGroupId, source.id));
      const ownIds = new Set(own.map((row) => row.id));
      const chosen = input.groups.flatMap((group) => group.productGroupIds);
      if (chosen.some((pg) => !ownIds.has(pg)) || new Set(chosen).size !== chosen.length) {
        throw new BadRequestException({ code: 'product_groups_invalid' });
      }
      const actor = await actorOf(tx, auth, org.id);
      const createdCodes: string[] = [];
      await auditedChange(tx, actor, materialGroupAudit, async () => {
        for (const entry of input.groups) {
          if (!codePattern.test(entry.code)) {
            throw new BadRequestException({ code: 'invalid_code' });
          }
          const [created] = await tx
            .insert(schema.materialGroup)
            .values({
              orgId: org.id,
              name: entry.name,
              code: entry.code,
              parentId: source.parentId,
              leadUserId: source.leadUserId,
              commodityManagerUserId: source.commodityManagerUserId,
            })
            .returning({ id: schema.materialGroup.id });
          const newId = created?.id as string;
          createdCodes.push(entry.code);
          await syncLeadership(tx, org.id, newId, source.leadUserId, source.commodityManagerUserId);
          if (entry.productGroupIds.length === 0) continue;
          await tx
            .update(schema.materialGroupProductGroup)
            .set({ materialGroupId: newId })
            .where(inArray(schema.materialGroupProductGroup.id, entry.productGroupIds));
          if (input.spend === 'by_product_group') {
            // Spend mit diesen Produktgruppen zieht mit um; die Zuordnung entsteht über den Trigger.
            await tx.execute(sql`
              update relationship_spend set material_group_id = ${newId}
              where product_group_id in ${entry.productGroupIds}
            `);
          } else {
            await tx.execute(sql`
              update relationship_spend set product_group_id = null
              where product_group_id in ${entry.productGroupIds}
            `);
          }
        }
        return {
          objectId: source.id,
          relationshipId: null,
          action: 'updated' as const,
          before: { split_into: null, spend: null },
          after: { split_into: createdCodes.join(', '), spend: input.spend },
          result: null,
        };
      });
      return this.detailIn(tx, auth, org, source.id);
    }).catch(translateMasterError);
  }
}

type DbError = { code?: string; message?: string; constraint?: string };
const causeOf = (error: unknown): DbError | undefined =>
  (error as { cause?: DbError }).cause ?? (error as DbError | undefined);

function translateTeamError(error: unknown): never {
  const cause = causeOf(error);
  if ((cause?.message ?? '').startsWith('foreign_user')) {
    throw conflict('foreign_user', 'Nur Personen der eigenen Organisation.');
  }
  throw error;
}

function translateProductGroupError(error: unknown): never {
  const cause = causeOf(error);
  if (cause?.code === '23505') throw conflict('name_taken', 'Diese Produktgruppe gibt es schon.');
  if (cause?.code === '23503') {
    throw conflict('in_use', 'Die Produktgruppe hat Spend; sie lässt sich nicht löschen.');
  }
  throw error;
}

function translateMasterError(error: unknown): never {
  const cause = causeOf(error);
  if (cause?.code === '23505' && /_code$/.test(cause.constraint ?? '')) {
    throw conflict('code_taken', 'Diesen Code gibt es in deiner Organisation schon.');
  }
  throw error;
}
