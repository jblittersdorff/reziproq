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
  desc,
  eq,
  schema,
  seedDefaultCatalog,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  appliesTo,
  type ProposalItem,
  type RuleSet,
  type RuleSetProposal,
  type RuleSetResponse,
  type RuleSetSharePreview,
  ruleSetProposalSchema,
  ruleSetResponseSchema,
  ruleSetSharePreviewSchema,
  type SaveRuleSet,
  type SegmentTarget,
  type SharedTarget,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { relationshipTargetAudit, ruleSetAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { readDecisions } from '../ratings/consolidation.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string, message: string) =>
  new ConflictException({ statusCode: 409, code, message });
const noTarget = () =>
  conflict('no_target', 'Ohne konsolidierten Soll-Typ gibt es keinen Vorschlag (SEG-06).');

type SetRow = typeof schema.ruleSet.$inferSelect;
const sameTarget = (row: SetRow, target: SegmentTarget | null) =>
  target !== null &&
  row.targetImpactLevel === target.impactLevel &&
  row.targetQualityLevel === target.qualityLevel;

/**
 * PLB-03: Spielregeln je Beziehung. Vorschlag aus dem Katalog (PLB-01) für den konsolidierten
 * Soll-Typ (SEG-06). Jede Abweichung braucht eine interne Begründung (buyer_private). Eine
 * freigegebene Version bleibt, wie sie ist; Bearbeiten legt dann eine neue Version an.
 */
@Injectable()
export class RuleSetsService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  /** Eigene Beziehung; verwalten dürfen Admin und SRO, nie mit Teamrolle Leser oder nach dem Ende. */
  private async context(
    tx: TenantTransaction,
    auth: AuthContext,
    organization: AccountOrganization,
    relationshipId: string,
  ) {
    const [relationship] = await tx
      .select({ status: schema.relationship.status })
      .from(schema.relationship)
      .where(
        and(
          eq(schema.relationship.id, relationshipId),
          eq(schema.relationship.buyerOrgId, organization.id),
        ),
      );
    if (!relationship) throw notFound();
    const [own] = await tx
      .select({ teamRole: schema.relationshipMember.teamRole })
      .from(schema.relationshipMember)
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, relationshipId),
          eq(schema.relationshipMember.orgId, organization.id),
          eq(schema.relationshipMember.userId, auth.userId),
        ),
      );
    const canManage =
      relationship.status !== 'ended' &&
      own?.teamRole !== 'viewer' &&
      (auth.orgRole === 'admin' || (auth.orgRole === 'member' && own?.teamRole === 'sro'));
    return { canManage };
  }

  /** Konsolidierter Soll-Typ der Beziehung insgesamt; ohne Konsolidierung null. */
  private async target(
    tx: TenantTransaction,
    organizationId: string,
    relationshipId: string,
  ): Promise<SegmentTarget | null> {
    const total = (await readDecisions(tx, organizationId, relationshipId))[0]?.entries.find(
      (entry) => entry.scope === 'total',
    );
    return total
      ? {
          impactLevel: total.soll.impactLevel,
          qualityLevel: total.soll.qualityLevel,
          typeName: total.soll.typeName,
        }
      : null;
  }

  /** Genau die Katalogeinträge, die für diesen Typ gelten (PLB-01). */
  private async proposalItems(
    tx: TenantTransaction,
    organizationId: string,
    target: SegmentTarget,
  ): Promise<ProposalItem[]> {
    await seedDefaultCatalog(tx, organizationId);
    const rules = await tx
      .select()
      .from(schema.ruleCatalogItem)
      .where(eq(schema.ruleCatalogItem.orgId, organizationId))
      .orderBy(asc(schema.ruleCatalogItem.position), asc(schema.ruleCatalogItem.createdAt));
    const formats = await tx
      .select()
      .from(schema.formatCatalogItem)
      .where(eq(schema.formatCatalogItem.orgId, organizationId))
      .orderBy(asc(schema.formatCatalogItem.position), asc(schema.formatCatalogItem.createdAt));
    const fits = (item: { minImpactLevel: number; forQualityLevels?: number[] }) =>
      appliesTo(item, target.impactLevel, target.qualityLevel);
    return [
      ...rules.filter(fits).map((rule) => ({
        catalogItemId: rule.id,
        kind: rule.kind,
        group: rule.group,
        title: rule.title,
        description: rule.description,
        cadence: null,
        level: null,
      })),
      ...formats.filter(fits).map((format) => ({
        catalogItemId: format.id,
        kind: 'format' as const,
        group: null,
        title: format.name,
        description: format.purpose,
        cadence: format.cadence,
        level: format.level,
      })),
    ];
  }

  private async currentRow(tx: TenantTransaction, organizationId: string, relationshipId: string) {
    const [row] = await tx
      .select()
      .from(schema.ruleSet)
      .where(
        and(
          eq(schema.ruleSet.relationshipId, relationshipId),
          eq(schema.ruleSet.ownerOrgId, organizationId),
        ),
      )
      .orderBy(desc(schema.ruleSet.version))
      .limit(1);
    return row ?? null;
  }

  private async readSet(tx: TenantTransaction, row: SetRow): Promise<RuleSet> {
    const items = await tx
      .select()
      .from(schema.ruleSetItem)
      .where(eq(schema.ruleSetItem.ruleSetId, row.id))
      .orderBy(asc(schema.ruleSetItem.position));
    const notes = await tx
      .select()
      .from(schema.ruleSetNote)
      .where(eq(schema.ruleSetNote.ruleSetId, row.id));
    const reasonOf = new Map(
      notes
        .filter((note) => note.ruleSetItemId)
        .map((note) => [note.ruleSetItemId, note.deviationReason]),
    );
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      visibility: row.visibility,
      target: {
        impactLevel: row.targetImpactLevel,
        qualityLevel: row.targetQualityLevel,
        typeName: row.typeName,
      },
      items: items.map((item) => ({
        id: item.id,
        catalogItemId: item.catalogItemId,
        origin: item.origin,
        kind: item.kind,
        group: item.group,
        title: item.title,
        description: item.description,
        cadence: item.cadence,
        level: item.level,
        reason: reasonOf.get(item.id) ?? null,
      })),
      removed: notes
        .filter((note) => note.catalogItemId && note.removedItem)
        .map((note) => ({
          item: note.removedItem as unknown as ProposalItem,
          reason: note.deviationReason,
        })),
      approvedBy: row.approvedByName,
      approvedAt: row.approvedAt?.toISOString() ?? null,
    };
  }

  get(auth: AuthContext, relationshipId: string): Promise<RuleSetResponse> {
    return this.run(auth, async (tx, organization) => {
      const { canManage } = await this.context(tx, auth, organization, relationshipId);
      return this.response(tx, organization.id, relationshipId, canManage);
    });
  }

  /**
   * Vorschlag für den konsolidierten Soll-Typ; mit basis „aktuell“ für den Typ der aktuellen
   * Version, gegen den das Bearbeiten die Abweichungen prüft.
   */
  proposal(
    auth: AuthContext,
    relationshipId: string,
    basis: 'soll' | 'aktuell' = 'soll',
  ): Promise<RuleSetProposal> {
    return this.run(auth, async (tx, organization) => {
      await this.context(tx, auth, organization, relationshipId);
      const current =
        basis === 'aktuell' ? await this.currentRow(tx, organization.id, relationshipId) : null;
      const target = current
        ? {
            impactLevel: current.targetImpactLevel,
            qualityLevel: current.targetQualityLevel,
            typeName: current.typeName,
          }
        : await this.target(tx, organization.id, relationshipId);
      if (!target) throw noTarget();
      return ruleSetProposalSchema.parse({
        target,
        items: await this.proposalItems(tx, organization.id, target),
      });
    });
  }

  /** Schreibt Einträge und Begründungen einer Version neu. */
  private async writeItems(
    tx: TenantTransaction,
    organizationId: string,
    relationshipId: string,
    setId: string,
    proposal: ProposalItem[],
    input: SaveRuleSet,
  ) {
    await tx.delete(schema.ruleSetNote).where(eq(schema.ruleSetNote.ruleSetId, setId));
    await tx.delete(schema.ruleSetItem).where(eq(schema.ruleSetItem.ruleSetId, setId));
    const base = { ruleSetId: setId, relationshipId, ownerOrgId: organizationId };
    const selected = new Set(input.selected);
    let position = 0;
    const catalogRows = proposal
      .filter((item) => selected.has(item.catalogItemId))
      .map((item) => ({
        ...base,
        kind: item.kind,
        group: item.group,
        title: item.title,
        description: item.description,
        cadence: item.cadence,
        level: item.level,
        origin: 'catalog' as const,
        catalogItemId: item.catalogItemId,
        position: ++position,
      }));
    if (catalogRows.length > 0) await tx.insert(schema.ruleSetItem).values(catalogRows);
    for (const custom of input.custom) {
      const [row] = await tx
        .insert(schema.ruleSetItem)
        .values({
          ...base,
          kind: custom.kind,
          group: custom.group,
          // Eigene Einträge haben einen Text; er gilt für beide Sprachen.
          title: { de: custom.title, en: custom.title },
          description: { de: custom.description, en: custom.description },
          cadence: custom.cadence,
          origin: 'custom',
          position: ++position,
        })
        .returning({ id: schema.ruleSetItem.id });
      if (!row) throw new Error('Eintrag nicht angelegt');
      await tx.insert(schema.ruleSetNote).values({
        relationshipId,
        ruleSetId: setId,
        ruleSetItemId: row.id,
        deviationReason: custom.reason,
      });
    }
    const removed = proposal.filter((item) => !selected.has(item.catalogItemId));
    if (removed.length > 0) {
      await tx.insert(schema.ruleSetNote).values(
        removed.map((item) => ({
          relationshipId,
          ruleSetId: setId,
          catalogItemId: item.catalogItemId,
          removedItem: item as unknown as Record<string, unknown>,
          deviationReason: input.removedReasons[item.catalogItemId] as string,
        })),
      );
    }
  }

  /**
   * Vorschlag übernehmen: ohne Spielregeln oder bei geändertem Soll-Typ. Ein offener Entwurf wird
   * dabei ersetzt, sonst entsteht eine neue Version.
   */
  adoptProposal(auth: AuthContext, relationshipId: string): Promise<RuleSetResponse> {
    return this.run(auth, async (tx, organization) => {
      const { canManage } = await this.context(tx, auth, organization, relationshipId);
      if (!canManage) throw forbidden();
      const target = await this.target(tx, organization.id, relationshipId);
      if (!target) throw noTarget();
      const current = await this.currentRow(tx, organization.id, relationshipId);
      if (current && sameTarget(current, target)) {
        throw conflict('already_adopted', 'Für diesen Soll-Typ gibt es schon Spielregeln.');
      }
      const proposal = await this.proposalItems(tx, organization.id, target);
      const input = {
        selected: proposal.map((item) => item.catalogItemId),
        removedReasons: {},
        custom: [],
      };
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, ruleSetAudit, async () => {
        let setId: string;
        let version: number;
        if (current?.status === 'draft') {
          await tx
            .update(schema.ruleSet)
            .set({
              targetImpactLevel: target.impactLevel,
              targetQualityLevel: target.qualityLevel,
              typeName: target.typeName,
            })
            .where(eq(schema.ruleSet.id, current.id));
          setId = current.id;
          version = current.version;
        } else {
          version = (current?.version ?? 0) + 1;
          const [row] = await tx
            .insert(schema.ruleSet)
            .values({
              relationshipId,
              ownerOrgId: organization.id,
              version,
              targetImpactLevel: target.impactLevel,
              targetQualityLevel: target.qualityLevel,
              typeName: target.typeName,
              createdBy: auth.userId,
            })
            .returning({ id: schema.ruleSet.id });
          if (!row) throw new Error('Spielregeln nicht angelegt');
          setId = row.id;
        }
        await this.writeItems(tx, organization.id, relationshipId, setId, proposal, input);
        return {
          objectId: setId,
          relationshipId,
          action: current?.status === 'draft' ? ('updated' as const) : ('created' as const),
          after: { version, status: 'draft', type_name: target.typeName },
          result: undefined,
        };
      });
      return this.response(tx, organization.id, relationshipId, true);
    });
  }

  private async response(
    tx: TenantTransaction,
    organizationId: string,
    relationshipId: string,
    canManage: boolean,
  ): Promise<RuleSetResponse> {
    const target = await this.target(tx, organizationId, relationshipId);
    const row = await this.currentRow(tx, organizationId, relationshipId);
    return ruleSetResponseSchema.parse({
      current: row ? await this.readSet(tx, row) : null,
      target,
      targetChanged: row !== null && target !== null && !sameTarget(row, target),
      canManage,
      shared: await this.shared(tx, organizationId, relationshipId),
    });
  }

  /** Was der Lieferant gerade sieht (SEG-10). */
  private async shared(
    tx: TenantTransaction,
    organizationId: string,
    relationshipId: string,
  ): Promise<SharedTarget | null> {
    const [row] = await tx
      .select()
      .from(schema.relationshipTarget)
      .where(
        and(
          eq(schema.relationshipTarget.relationshipId, relationshipId),
          eq(schema.relationshipTarget.ownerOrgId, organizationId),
          eq(schema.relationshipTarget.visibility, 'shared'),
        ),
      );
    return row
      ? {
          version: row.ruleSetVersion,
          typeName: row.typeName,
          typeDescription: row.typeDescription,
          sharedAt: row.sharedAt.toISOString(),
        }
      : null;
  }

  /** Name und Beschreibung des Typs im aktiven Segmentmodell, als Stand fürs Teilen (SEG-10). */
  private async typeOf(tx: TenantTransaction, organizationId: string, row: SetRow) {
    const [type] = await tx
      .select({ name: schema.segmentType.name, description: schema.segmentType.description })
      .from(schema.segmentType)
      .innerJoin(schema.segmentModel, eq(schema.segmentModel.id, schema.segmentType.modelId))
      .where(
        and(
          eq(schema.segmentModel.orgId, organizationId),
          eq(schema.segmentModel.status, 'active'),
          eq(schema.segmentType.impactLevel, row.targetImpactLevel),
          eq(schema.segmentType.qualityLevel, row.targetQualityLevel),
        ),
      );
    return { name: type?.name ?? row.typeName, description: type?.description ?? '' };
  }

  private async shareable(tx: TenantTransaction, organizationId: string, relationshipId: string) {
    const current = await this.currentRow(tx, organizationId, relationshipId);
    if (!current || current.status === 'draft') {
      throw conflict('not_approved', 'Teilen lässt sich nur eine intern freigegebene Version.');
    }
    return current;
  }

  /** Vorschau genau so, wie der Lieferant sie sehen wird (SEG-10). */
  sharePreview(auth: AuthContext, relationshipId: string): Promise<RuleSetSharePreview> {
    return this.run(auth, async (tx, organization) => {
      await this.context(tx, auth, organization, relationshipId);
      const current = await this.shareable(tx, organization.id, relationshipId);
      const set = await this.readSet(tx, current);
      return ruleSetSharePreviewSchema.parse({
        version: current.version,
        ...(await this.typeOf(tx, organization.id, current).then((type) => ({
          typeName: type.name,
          typeDescription: type.description,
        }))),
        items: set.items.map((item) => ({
          kind: item.kind,
          group: item.group,
          title: item.title,
          description: item.description,
          cadence: item.cadence,
        })),
      });
    });
  }

  /**
   * Mit dem Lieferanten teilen: Typ und Beschreibung als Stand, diese Version wird sichtbar, eine
   * früher geteilte wieder intern. Begründungen bleiben käuferprivat.
   */
  share(auth: AuthContext, relationshipId: string): Promise<RuleSetResponse> {
    return this.run(auth, async (tx, organization) => {
      const { canManage } = await this.context(tx, auth, organization, relationshipId);
      if (!canManage) throw forbidden();
      const current = await this.shareable(tx, organization.id, relationshipId);
      if (current.status === 'shared' && current.visibility === 'shared') {
        throw conflict('already_shared', 'Diese Version ist schon geteilt.');
      }
      const type = await this.typeOf(tx, organization.id, current);
      const own = and(
        eq(schema.ruleSet.relationshipId, relationshipId),
        eq(schema.ruleSet.ownerOrgId, organization.id),
      );
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, relationshipTargetAudit, async () => {
        const previous = await this.shared(tx, organization.id, relationshipId);
        await tx.update(schema.ruleSet).set({ visibility: 'internal' }).where(own);
        await tx
          .update(schema.ruleSetItem)
          .set({ visibility: 'internal' })
          .where(
            and(
              eq(schema.ruleSetItem.relationshipId, relationshipId),
              eq(schema.ruleSetItem.ownerOrgId, organization.id),
            ),
          );
        await tx
          .update(schema.ruleSet)
          .set({ visibility: 'shared', status: 'shared' })
          .where(eq(schema.ruleSet.id, current.id));
        await tx
          .update(schema.ruleSetItem)
          .set({ visibility: 'shared' })
          .where(eq(schema.ruleSetItem.ruleSetId, current.id));
        await tx
          .delete(schema.relationshipTarget)
          .where(
            and(
              eq(schema.relationshipTarget.relationshipId, relationshipId),
              eq(schema.relationshipTarget.ownerOrgId, organization.id),
            ),
          );
        const [row] = await tx
          .insert(schema.relationshipTarget)
          .values({
            relationshipId,
            ownerOrgId: organization.id,
            visibility: 'shared',
            typeName: type.name,
            typeDescription: type.description,
            ruleSetId: current.id,
            ruleSetVersion: current.version,
            sharedBy: auth.userId,
            sharedByName: actor.name,
          })
          .returning({ id: schema.relationshipTarget.id });
        if (!row) throw new Error('Beziehungstyp nicht geteilt');
        return {
          objectId: row.id,
          relationshipId,
          action: 'shared' as const,
          before: previous
            ? { type_name: previous.typeName, rule_set_version: previous.version }
            : null,
          after: { type_name: type.name, rule_set_version: current.version },
          result: undefined,
        };
      });
      return this.response(tx, organization.id, relationshipId, true);
    });
  }

  /** Bearbeiten: im Entwurf direkt, nach einer Freigabe als neue Version mit demselben Soll-Typ. */
  save(auth: AuthContext, relationshipId: string, input: SaveRuleSet): Promise<RuleSetResponse> {
    return this.run(auth, async (tx, organization) => {
      const { canManage } = await this.context(tx, auth, organization, relationshipId);
      if (!canManage) throw forbidden();
      const current = await this.currentRow(tx, organization.id, relationshipId);
      if (!current) throw conflict('no_rule_set', 'Erst den Vorschlag übernehmen.');
      const target = {
        impactLevel: current.targetImpactLevel,
        qualityLevel: current.targetQualityLevel,
        typeName: current.typeName,
      };
      const proposal = await this.proposalItems(tx, organization.id, target);
      const known = new Set(proposal.map((item) => item.catalogItemId));
      if (input.selected.some((id) => !known.has(id))) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'unknown_item',
          message: 'Gewählt werden nur Einträge aus dem Vorschlag.',
        });
      }
      const selected = new Set(input.selected);
      const missing = proposal.filter(
        (item) => !selected.has(item.catalogItemId) && !input.removedReasons[item.catalogItemId],
      );
      if (missing.length > 0) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'reason_required',
          message: 'Jede Abweichung vom Katalog braucht eine interne Begründung.',
          items: missing.map((item) => item.catalogItemId),
        });
      }
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, ruleSetAudit, async () => {
        let setId = current.id;
        let version = current.version;
        const action = current.status === 'draft' ? ('updated' as const) : ('created' as const);
        if (current.status !== 'draft') {
          version = current.version + 1;
          const [row] = await tx
            .insert(schema.ruleSet)
            .values({
              relationshipId,
              ownerOrgId: organization.id,
              version,
              targetImpactLevel: target.impactLevel,
              targetQualityLevel: target.qualityLevel,
              typeName: target.typeName,
              createdBy: auth.userId,
            })
            .returning({ id: schema.ruleSet.id });
          if (!row) throw new Error('Version nicht angelegt');
          setId = row.id;
        }
        await this.writeItems(tx, organization.id, relationshipId, setId, proposal, input);
        return {
          objectId: setId,
          relationshipId,
          action,
          after: { version, status: 'draft', type_name: target.typeName },
          result: undefined,
        };
      });
      return this.response(tx, organization.id, relationshipId, true);
    });
  }

  /** Intern freigeben: Der Entwurf ist ab dann gesperrt. */
  approve(auth: AuthContext, relationshipId: string): Promise<RuleSetResponse> {
    return this.run(auth, async (tx, organization) => {
      const { canManage } = await this.context(tx, auth, organization, relationshipId);
      if (!canManage) throw forbidden();
      const current = await this.currentRow(tx, organization.id, relationshipId);
      if (current?.status !== 'draft') {
        throw conflict('not_draft', 'Freigeben lässt sich nur ein Entwurf.');
      }
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, ruleSetAudit, async () => {
        await tx
          .update(schema.ruleSet)
          .set({
            status: 'approved',
            approvedBy: auth.userId,
            approvedByName: actor.name,
            approvedAt: sql`now()`,
          })
          .where(eq(schema.ruleSet.id, current.id));
        return {
          objectId: current.id,
          relationshipId,
          action: 'approved' as const,
          before: { version: current.version, status: 'draft' },
          after: { version: current.version, status: 'approved' },
          result: undefined,
        };
      });
      return this.response(tx, organization.id, relationshipId, true);
    });
  }
}
