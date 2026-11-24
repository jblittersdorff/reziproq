import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  auditedChange,
  currentTime,
  eq,
  inArray,
  schema,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type FocusDetail,
  type FocusList,
  focusDetailSchema,
  focusListSchema,
  lastFullYear,
  type SetFocusRequest,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { relationshipSideAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { ensureActiveCycle } from '../overview/cycle.js';
import { typeNames } from '../ratings/consolidation.js';
import { listSuppliers } from '../suppliers/suppliers.service.js';
import { type FocusCandidate, shares, suggestFocus } from './suggest.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

/** Fokuslieferanten (SEG-02): nur die Käuferseite; relationship_side ist org_private (PLT-04). */
@Injectable()
export class FocusService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  /** Alles, was Liste und Detail brauchen: Lieferanten, Fokusdaten, Soll-Typen, Schwelle. */
  private async load(tx: TenantTransaction, orgId: string) {
    const spendYear = lastFullYear();
    const suppliers = (await listSuppliers(tx, spendYear)).filter((s) => s.status !== 'ended');
    const ids = suppliers.map((supplier) => supplier.relationshipId);
    const [active] = await tx
      .select({ share: schema.segmentModel.focusSpendShare })
      .from(schema.segmentModel)
      .where(and(eq(schema.segmentModel.orgId, orgId), eq(schema.segmentModel.status, 'active')));
    const side = ids.length
      ? await tx
          .select({
            relationshipId: schema.relationshipSide.relationshipId,
            reason: schema.relationshipSide.focusReason,
            setAt: schema.relationshipSide.focusSetAt,
            setBy: schema.appUser.name,
          })
          .from(schema.relationshipSide)
          .leftJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipSide.focusSetBy))
          .where(
            and(
              inArray(schema.relationshipSide.relationshipId, ids),
              eq(schema.relationshipSide.isFocus, true),
            ),
          )
      : [];
    const focusById = new Map(side.map((row) => [row.relationshipId, row]));

    // Letzte Konsolidierung (Gesamt) je Beziehung: höchste Version, Umfang total.
    const d = schema.segmentDecision;
    const rows = ids.length
      ? await tx
          .select({
            relationshipId: d.relationshipId,
            version: d.version,
            modelVersion: d.modelVersion,
            istImpact: d.istImpactLevel,
            istQuality: d.istQualityLevel,
            sollImpact: d.sollImpactLevel,
            sollQuality: d.sollQualityLevel,
          })
          .from(d)
          .where(and(inArray(d.relationshipId, ids), eq(d.scope, 'total')))
      : [];
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const best = latest.get(row.relationshipId);
      if (!best || row.version > best.version) latest.set(row.relationshipId, row);
    }
    const names = new Map<number, Map<string, string>>();
    for (const { modelVersion } of latest.values()) {
      if (!names.has(modelVersion))
        names.set(modelVersion, await typeNames(tx, orgId, modelVersion));
    }
    const level = (id: string, side: 'ist' | 'soll') => {
      const row = latest.get(id);
      if (!row) return null;
      const impactLevel = side === 'ist' ? row.istImpact : row.sollImpact;
      const qualityLevel = side === 'ist' ? row.istQuality : row.sollQuality;
      return {
        impactLevel,
        qualityLevel,
        typeName: names.get(row.modelVersion)?.get(`${impactLevel}-${qualityLevel}`) ?? '',
      };
    };

    const candidates: FocusCandidate[] = suppliers.map((supplier) => ({
      relationshipId: supplier.relationshipId,
      spendCents: supplier.spend?.amountCents ?? 0,
      currency: supplier.spend?.currency ?? 'EUR',
      sollImpact: latest.get(supplier.relationshipId)?.sollImpact ?? null,
    }));
    const spendShare = active?.share ?? 80;
    const share = shares(candidates);
    const suggestions = suggestFocus(candidates, spendShare, new Set(focusById.keys()));
    const item = (supplier: (typeof suppliers)[number]) => ({
      relationshipId: supplier.relationshipId,
      name: supplier.name,
      spendCents: supplier.spend?.amountCents ?? 0,
      currency: supplier.spend?.currency ?? 'EUR',
      sharePercent: share.get(supplier.relationshipId) ?? 0,
      ist: level(supplier.relationshipId, 'ist'),
      soll: level(supplier.relationshipId, 'soll'),
    });
    return { spendYear, spendShare, suppliers, focusById, suggestions, item };
  }

  async list(auth: AuthContext): Promise<FocusList> {
    return this.run(auth, async (tx, organization) => {
      const data = await this.load(tx, organization.id);
      const bySpend = (a: { spendCents: number; name: string }, b: typeof a) =>
        b.spendCents - a.spendCents || a.name.localeCompare(b.name, 'de');
      return focusListSchema.parse({
        spendYear: data.spendYear,
        spendShare: data.spendShare,
        canEdit: can(auth, 'fokus.setzen'),
        focus: data.suppliers
          .filter((s) => data.focusById.has(s.relationshipId))
          .map((s) => ({
            ...data.item(s),
            reason: data.focusById.get(s.relationshipId)?.reason ?? '',
          }))
          .sort(bySpend),
        suggestions: data.suppliers
          .filter((s) => data.suggestions.has(s.relationshipId))
          .map((s) => ({ ...data.item(s), reasons: data.suggestions.get(s.relationshipId) ?? [] }))
          .sort(bySpend),
      });
    });
  }

  async detail(auth: AuthContext, relationshipId: string): Promise<FocusDetail> {
    return this.run(auth, async (tx, organization) => {
      const data = await this.load(tx, organization.id);
      return this.detailOf(auth, data, relationshipId);
    });
  }

  private detailOf(
    auth: AuthContext,
    data: Awaited<ReturnType<FocusService['load']>>,
    relationshipId: string,
  ): FocusDetail {
    const supplier = data.suppliers.find((entry) => entry.relationshipId === relationshipId);
    if (!supplier) {
      throw new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
    }
    const focus = data.focusById.get(relationshipId);
    return focusDetailSchema.parse({
      ...data.item(supplier),
      spendYear: data.spendYear,
      isFocus: Boolean(focus),
      reason: focus?.reason ?? null,
      setAt: focus?.setAt?.toISOString() ?? null,
      setBy: focus?.setBy ?? null,
      suggestionReasons: data.suggestions.get(relationshipId) ?? [],
      canEdit: can(auth, 'fokus.setzen'),
    });
  }

  /** Setzt oder entfernt den Fokus, immer mit Begründung und Eintrag im internen Verlauf. */
  async set(
    auth: AuthContext,
    relationshipId: string,
    request: SetFocusRequest,
  ): Promise<FocusDetail> {
    return this.run(auth, async (tx, organization) => {
      const data = await this.load(tx, organization.id);
      if (!data.suppliers.some((entry) => entry.relationshipId === relationshipId)) {
        throw new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
      }
      const actor = await actorOf(tx, auth, organization.id);
      const { relationshipSide } = schema;
      const [before] = await tx
        .select({ is_focus: relationshipSide.isFocus, focus_reason: relationshipSide.focusReason })
        .from(relationshipSide)
        .where(
          and(
            eq(relationshipSide.relationshipId, relationshipId),
            eq(relationshipSide.orgId, organization.id),
          ),
        );
      const after = { is_focus: request.isFocus, focus_reason: request.reason };
      await auditedChange(tx, actor, relationshipSideAudit, async () => {
        const values = {
          isFocus: request.isFocus,
          focusReason: request.reason,
          focusSetBy: auth.userId,
          focusSetAt: currentTime(),
        };
        await tx
          .insert(relationshipSide)
          .values({ relationshipId, orgId: organization.id, ...values })
          .onConflictDoUpdate({
            target: [relationshipSide.relationshipId, relationshipSide.orgId],
            set: values,
          });
        return {
          objectId: relationshipId,
          relationshipId,
          action: 'updated',
          before: before ?? { is_focus: false, focus_reason: null },
          after,
          result: undefined,
        };
      });
      if (request.isFocus) await ensureActiveCycle(tx, relationshipId);
      return this.detailOf(auth, await this.load(tx, organization.id), relationshipId);
    });
  }
}
