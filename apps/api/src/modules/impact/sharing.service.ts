import {
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
  currentTime,
  desc,
  eq,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import type {
  CustomerImpact,
  ImpactList,
  SaveBenefit,
  SaveShare,
  SavingsReference,
} from '@reziproq/shared';
import { actorOf } from '../audit/actor.js';
import {
  initiativeShareAudit,
  savingsReferenceAudit,
  supplierBenefitAudit,
} from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';
import { type ImpactScope, ImpactService } from './impact.service.js';
import { sharesOf, totalsOf, valuesOf } from './sharing.js';
import { recompute } from './values.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/**
 * PNL-07: Teilungsregel (Käufer schlägt vor, Lieferant bestätigt), Savings-Verweis des Käufers und
 * eigener Nutzen des Lieferanten. Beide Seiten sehen die vereinbarte Wirkung; interne Zahlen
 * bleiben auf ihrer Seite (RLS).
 */
@Injectable()
export class SharingService {
  constructor(
    @Inject(ImpactService) private readonly impact: ImpactService,
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  /** Geteilte Initiative der Beziehung; eine interne lässt sich nicht teilen. */
  private async sharedInitiative(tx: TenantTransaction, relationshipId: string, id: string) {
    const [row] = await tx
      .select({ id: schema.initiative.id, visibility: schema.initiative.visibility })
      .from(schema.initiative)
      .where(
        and(eq(schema.initiative.id, id), eq(schema.initiative.relationshipId, relationshipId)),
      );
    if (!row) throw notFound();
    return row;
  }

  saveShare(auth: AuthContext, relationshipId: string, initiativeId: string, input: SaveShare) {
    return this.impact.run(auth, relationshipId, async (scope): Promise<ImpactList> => {
      if (!this.impact.canLead(scope)) throw forbidden();
      const { tx } = scope;
      const initiative = await this.sharedInitiative(tx, relationshipId, initiativeId);
      if (initiative.visibility !== 'shared') {
        throw new ConflictException({ statusCode: 409, code: 'initiative_internal' });
      }
      const actor = await actorOf(tx, auth, scope.orgId);
      const [before] = await tx
        .select()
        .from(schema.initiativeShare)
        .where(
          and(
            eq(schema.initiativeShare.initiativeId, initiativeId),
            eq(schema.initiativeShare.visibility, 'shared'),
          ),
        )
        .limit(1);
      await auditedChange(tx, actor, initiativeShareAudit, async () => {
        // Jede Änderung setzt die Bestätigung des Lieferanten zurück.
        const values = {
          buyerSharePct: input.buyerSharePct,
          supplierSharePct: input.supplierSharePct,
          ruleText: input.ruleText || null,
          proposedBy: auth.userId,
          proposedByName: actor.name,
          proposedAt: currentTime(),
          supplierConfirmedByName: null,
          agreedAt: null,
        };
        if (before) {
          await tx
            .update(schema.initiativeShare)
            .set(values)
            .where(eq(schema.initiativeShare.id, before.id));
        } else {
          await tx.insert(schema.initiativeShare).values({
            ...values,
            relationshipId,
            ownerOrgId: scope.orgId,
            visibility: 'shared',
            initiativeId,
          });
        }
        return {
          objectId: initiativeId,
          relationshipId,
          action: before ? ('updated' as const) : ('created' as const),
          before: before
            ? {
                buyer_share_pct: before.buyerSharePct,
                supplier_share_pct: before.supplierSharePct,
                rule_text: before.ruleText,
                agreed: before.agreedAt !== null,
              }
            : null,
          after: {
            buyer_share_pct: input.buyerSharePct,
            supplier_share_pct: input.supplierSharePct,
            rule_text: input.ruleText || null,
            agreed: false,
          },
          result: undefined,
        };
      });
      // Bis zur erneuten Bestätigung ist die Wirkung wieder intern.
      await recompute(tx, initiativeId);
      return this.impact.list(scope);
    });
  }

  setReference(
    auth: AuthContext,
    relationshipId: string,
    initiativeId: string,
    input: SavingsReference | null,
  ) {
    return this.impact.run(auth, relationshipId, async (scope): Promise<ImpactList> => {
      if (!this.impact.canLead(scope)) throw forbidden();
      const { tx } = scope;
      await this.sharedInitiative(tx, relationshipId, initiativeId);
      const actor = await actorOf(tx, auth, scope.orgId);
      const [before] = await tx
        .select()
        .from(schema.savingsReference)
        .where(eq(schema.savingsReference.initiativeId, initiativeId));
      await auditedChange(tx, actor, savingsReferenceAudit, async () => {
        if (before) {
          await tx.delete(schema.savingsReference).where(eq(schema.savingsReference.id, before.id));
        }
        if (input) {
          await tx.insert(schema.savingsReference).values({
            relationshipId,
            initiativeId,
            system: input.system,
            reference: input.reference,
            createdBy: auth.userId,
          });
        }
        return {
          objectId: initiativeId,
          relationshipId,
          action: input
            ? before
              ? ('updated' as const)
              : ('created' as const)
            : ('ended' as const),
          before: before ? { system: before.system, reference: before.reference } : null,
          after: input ? { system: input.system, reference: input.reference } : null,
          result: undefined,
        };
      });
      return this.impact.list(scope);
    });
  }

  // Lieferantenseite: /kunden/<beziehung>/wirkung, im Kontext des Kunden.

  private supplierScope<T>(
    auth: AuthContext,
    relationshipId: string,
    work: (tx: TenantTransaction, teamRole: string | null) => Promise<T>,
  ) {
    return this.customers.inCustomer(auth, relationshipId, async (tx) => {
      const [member] = await tx
        .select({ teamRole: schema.relationshipMember.teamRole })
        .from(schema.relationshipMember)
        .where(
          and(
            eq(schema.relationshipMember.relationshipId, relationshipId),
            eq(schema.relationshipMember.orgId, auth.organization?.id as string),
            eq(schema.relationshipMember.userId, auth.userId),
          ),
        );
      return work(tx, member?.teamRole ?? null);
    });
  }

  /** Key Account Manager (Teamrolle sro der Lieferantenseite) oder Admin. */
  private canConfirm(auth: AuthContext, teamRole: string | null) {
    return (
      can(auth, 'teilung.vereinbaren', { teamRole: teamRole as never }) &&
      (auth.orgRole === 'admin' || teamRole === 'sro')
    );
  }

  customer(auth: AuthContext, relationshipId: string): Promise<CustomerImpact> {
    return this.supplierScope(auth, relationshipId, (tx, teamRole) =>
      this.readCustomer(tx, auth, relationshipId, teamRole),
    );
  }

  confirm(auth: AuthContext, relationshipId: string, initiativeId: string) {
    return this.supplierScope(auth, relationshipId, async (tx, teamRole) => {
      if (!this.canConfirm(auth, teamRole)) throw forbidden();
      const [share] = await tx
        .select()
        .from(schema.initiativeShare)
        .where(
          and(
            eq(schema.initiativeShare.initiativeId, initiativeId),
            eq(schema.initiativeShare.relationshipId, relationshipId),
            eq(schema.initiativeShare.visibility, 'shared'),
          ),
        )
        .orderBy(desc(schema.initiativeShare.proposedAt))
        .limit(1);
      if (!share) throw notFound();
      const actor = await actorOf(tx, auth, auth.organization?.id as string);
      await auditedChange(tx, actor, initiativeShareAudit, async () => {
        await tx.execute(sql`select app_initiative_share_confirm(${share.id}, ${actor.name})`);
        return {
          objectId: initiativeId,
          relationshipId,
          action: 'approved' as const,
          before: { agreed: share.agreedAt !== null },
          after: { agreed: true },
          result: undefined,
        };
      });
      return this.readCustomer(tx, auth, relationshipId, teamRole);
    });
  }

  saveBenefit(
    auth: AuthContext,
    relationshipId: string,
    initiativeId: string,
    benefitId: string | null,
    input: SaveBenefit | null,
  ) {
    return this.supplierScope(auth, relationshipId, async (tx, teamRole) => {
      if (!can(auth, 'eigene_sicht.bearbeiten')) throw forbidden();
      await this.sharedInitiative(tx, relationshipId, initiativeId);
      const actor = await actorOf(tx, auth, auth.organization?.id as string);
      const [before] = benefitId
        ? await tx
            .select()
            .from(schema.supplierBenefit)
            .where(
              and(
                eq(schema.supplierBenefit.id, benefitId),
                eq(schema.supplierBenefit.initiativeId, initiativeId),
              ),
            )
        : [];
      if (benefitId && !before) throw notFound();
      try {
        await auditedChange(tx, actor, supplierBenefitAudit, async () => {
          if (before) {
            await tx.delete(schema.supplierBenefit).where(eq(schema.supplierBenefit.id, before.id));
          }
          if (input) {
            await tx.insert(schema.supplierBenefit).values({
              relationshipId,
              initiativeId,
              month: input.month,
              amountCents: input.amountCents,
              currency: input.currency,
              note: input.note || null,
              createdBy: auth.userId,
            });
          }
          const pick = (row: { month: string; amountCents: number } | null | undefined) =>
            row ? { month: row.month, amount_cents: row.amountCents } : null;
          return {
            objectId: initiativeId,
            relationshipId,
            action: !input
              ? ('ended' as const)
              : before
                ? ('updated' as const)
                : ('created' as const),
            before: pick(before),
            after: pick(input),
            result: undefined,
          };
        });
      } catch (error) {
        if ((error as { cause?: { code?: string } }).cause?.code === '23505') {
          throw new ConflictException({ statusCode: 409, code: 'duplicate_month' });
        }
        throw error;
      }
      return this.readCustomer(tx, auth, relationshipId, teamRole);
    });
  }

  private async readCustomer(
    tx: TenantTransaction,
    auth: AuthContext,
    relationshipId: string,
    teamRole: string | null,
  ): Promise<CustomerImpact> {
    // Geteilte Initiativen der Beziehung; RLS zeigt dem Lieferanten nur diese.
    const initiatives = await tx
      .select({ id: schema.initiative.id, title: schema.initiative.title })
      .from(schema.initiative)
      .where(eq(schema.initiative.relationshipId, relationshipId))
      .orderBy(asc(schema.initiative.startsOn), asc(schema.initiative.createdAt));
    const ids = initiatives.map((entry) => entry.id);
    const shares = await sharesOf(tx, ids);
    // Nur vereinbarte Wirkung ist für den Lieferanten sichtbar (RLS); interne Zeilen fehlen.
    const values = await valuesOf(tx, ids);
    const benefits = ids.length
      ? await tx
          .select()
          .from(schema.supplierBenefit)
          .where(eq(schema.supplierBenefit.relationshipId, relationshipId))
          .orderBy(asc(schema.supplierBenefit.month))
      : [];
    const benefitTotals = new Map<string, number>();
    for (const row of benefits) {
      benefitTotals.set(row.currency, (benefitTotals.get(row.currency) ?? 0) + row.amountCents);
    }
    return {
      initiatives: initiatives.map((entry) => ({
        id: entry.id,
        title: entry.title,
        share: shares.get(entry.id) ?? null,
        value: values.get(entry.id) ?? null,
        benefits: benefits
          .filter((row) => row.initiativeId === entry.id)
          .map((row) => ({
            id: row.id,
            month: row.month,
            amountCents: row.amountCents,
            currency: row.currency,
            note: row.note,
          })),
      })),
      totals: totalsOf([...values.values()]),
      benefitTotals: [...benefitTotals.entries()].map(([currency, amountCents]) => ({
        currency,
        amountCents,
      })),
      canConfirm: this.canConfirm(auth, teamRole),
      canEditBenefit: can(auth, 'eigene_sicht.bearbeiten'),
    };
  }
}

export type { ImpactScope };
