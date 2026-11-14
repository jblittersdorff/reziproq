import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, auditedChange, desc, eq, schema, type TenantTransaction } from '@reziproq/db';
import {
  type AccountPlan,
  accountPlanSchema,
  type SaveAccountObjective,
  type SaveAccountSummary,
  type SaveAccountView,
} from '@reziproq/shared';
import { actorOf } from '../audit/actor.js';
import { accountPlanAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from './customers.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

interface Scope {
  tx: TenantTransaction;
  auth: AuthContext;
  orgId: string;
  relationshipId: string;
}

/**
 * LIF-03: Eigene Sicht des Lieferanten. Läuft nur im Kontext eines Kunden auf der
 * Lieferantenseite; die Tabellen sind lieferantenprivat, der Käufer sieht weder Zeilen noch
 * Anzahlen. Alle Nutzer der Lieferantenorganisation sehen dieselbe Sicht.
 */
@Injectable()
export class AccountPlanService {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}

  private scoped<T>(auth: AuthContext, relationshipId: string, work: (scope: Scope) => Promise<T>) {
    return this.customers.inCustomer(auth, relationshipId, (tx) =>
      work({ tx, auth, orgId: auth.organization?.id as string, relationshipId }),
    );
  }

  private async latest(scope: Scope) {
    const [row] = await scope.tx
      .select()
      .from(schema.supplierAccountPlan)
      .where(eq(schema.supplierAccountPlan.relationshipId, scope.relationshipId))
      .orderBy(desc(schema.supplierAccountPlan.updatedAt))
      .limit(1);
    return row ?? null;
  }

  private async people(scope: Scope) {
    return scope.tx
      .select({ userId: schema.appUser.id, name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.organizationId, scope.orgId))
      .orderBy(asc(schema.appUser.name));
  }

  private async read(scope: Scope): Promise<AccountPlan> {
    const plan = await this.latest(scope);
    const objectives = await scope.tx
      .select()
      .from(schema.supplierAccountObjective)
      .where(eq(schema.supplierAccountObjective.relationshipId, scope.relationshipId))
      .orderBy(
        asc(schema.supplierAccountObjective.targetYear),
        asc(schema.supplierAccountObjective.createdAt),
      );
    const canEdit = can(scope.auth, 'eigene_sicht.bearbeiten');
    return accountPlanSchema.parse({
      plan: plan
        ? {
            summary: plan.summary,
            ownView: plan.ownViewOfCustomer,
            importance: plan.customerImportance,
            updatedAt: plan.updatedAt.toISOString(),
            updatedByName: plan.updatedByName,
          }
        : null,
      objectives: objectives.map((row) => ({
        id: row.id,
        text: row.text,
        ownerUserId: row.ownerUserId,
        ownerName: row.ownerName,
        targetYear: row.targetYear,
      })),
      people: canEdit ? await this.people(scope) : [],
      canEdit,
    });
  }

  get(auth: AuthContext, relationshipId: string): Promise<AccountPlan> {
    return this.scoped(auth, relationshipId, (scope) => this.read(scope));
  }

  /** Zusammenfassung oder Sicht ändern; die übrigen Felder bleiben. */
  private async savePlan(
    scope: Scope,
    change: {
      summary?: string | null;
      ownViewOfCustomer?: string | null;
      customerImportance?: number | null;
    },
  ) {
    if (!can(scope.auth, 'eigene_sicht.bearbeiten')) throw forbidden();
    const before = await this.latest(scope);
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    await auditedChange(scope.tx, actor, accountPlanAudit, async () => {
      if (before) {
        await scope.tx
          .update(schema.supplierAccountPlan)
          .set({
            ...change,
            updatedBy: scope.auth.userId,
            updatedByName: actor.name,
            updatedAt: new Date(),
          })
          .where(eq(schema.supplierAccountPlan.id, before.id));
      } else {
        await scope.tx.insert(schema.supplierAccountPlan).values({
          relationshipId: scope.relationshipId,
          ...change,
          updatedBy: scope.auth.userId,
          updatedByName: actor.name,
        });
      }
      const after = { ...before, ...change };
      return {
        objectId: scope.relationshipId,
        relationshipId: scope.relationshipId,
        action: before ? ('updated' as const) : ('created' as const),
        before: before
          ? {
              summary: before.summary,
              own_view: before.ownViewOfCustomer,
              importance: before.customerImportance,
              objective: null,
              target_year: null,
            }
          : null,
        after: {
          summary: after.summary ?? null,
          own_view: after.ownViewOfCustomer ?? null,
          importance: after.customerImportance ?? null,
          objective: null,
          target_year: null,
        },
        result: undefined,
      };
    });
    return this.read(scope);
  }

  saveSummary(auth: AuthContext, relationshipId: string, input: SaveAccountSummary) {
    return this.scoped(auth, relationshipId, (scope) =>
      this.savePlan(scope, { summary: input.summary || null }),
    );
  }

  saveView(auth: AuthContext, relationshipId: string, input: SaveAccountView) {
    return this.scoped(auth, relationshipId, (scope) =>
      this.savePlan(scope, {
        ownViewOfCustomer: input.ownView || null,
        customerImportance: input.importance,
      }),
    );
  }

  /** Ziel anlegen (objectiveId null), ändern oder löschen (input null). */
  saveObjective(
    auth: AuthContext,
    relationshipId: string,
    objectiveId: string | null,
    input: SaveAccountObjective | null,
  ): Promise<AccountPlan> {
    return this.scoped(auth, relationshipId, async (scope) => {
      if (!can(auth, 'eigene_sicht.bearbeiten')) throw forbidden();
      const { tx } = scope;
      const [before] = objectiveId
        ? await tx
            .select()
            .from(schema.supplierAccountObjective)
            .where(
              and(
                eq(schema.supplierAccountObjective.id, objectiveId),
                eq(schema.supplierAccountObjective.relationshipId, relationshipId),
              ),
            )
        : [];
      if (objectiveId && !before) throw notFound();
      let owner: { ownerUserId: string | null; ownerName: string | null } = {
        ownerUserId: null,
        ownerName: null,
      };
      if (input?.ownerUserId) {
        const person = (await this.people(scope)).find(
          (entry) => entry.userId === input.ownerUserId,
        );
        if (!person) throw notFound();
        owner = { ownerUserId: person.userId, ownerName: person.name };
      }
      const actor = await actorOf(tx, auth, scope.orgId);
      await auditedChange(tx, actor, accountPlanAudit, async () => {
        let id = objectiveId as string;
        if (!input && before) {
          await tx
            .delete(schema.supplierAccountObjective)
            .where(eq(schema.supplierAccountObjective.id, before.id));
        } else if (before && input) {
          await tx
            .update(schema.supplierAccountObjective)
            .set({ text: input.text, targetYear: input.targetYear, ...owner })
            .where(eq(schema.supplierAccountObjective.id, before.id));
        } else if (input) {
          const [row] = await tx
            .insert(schema.supplierAccountObjective)
            .values({ relationshipId, text: input.text, targetYear: input.targetYear, ...owner })
            .returning({ id: schema.supplierAccountObjective.id });
          id = row?.id as string;
        }
        const snapshot = (text: string | null, year: number | null) => ({
          summary: null,
          own_view: null,
          importance: null,
          objective: text,
          target_year: year,
        });
        return {
          objectId: id,
          relationshipId,
          action: !input
            ? ('ended' as const)
            : before
              ? ('updated' as const)
              : ('created' as const),
          before: before ? snapshot(before.text, before.targetYear) : null,
          after: input ? snapshot(input.text, input.targetYear) : snapshot(null, null),
          result: undefined,
        };
      });
      return this.read(scope);
    });
  }
}
