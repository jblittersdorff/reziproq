import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, schema, sql } from '@reziproq/db';
import {
  type DueItem,
  type DueList,
  dueListSchema,
  type NextMeeting,
  type StartData,
  startSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { ActionsService } from '../actions/actions.service.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';
import { nextMeetingOf } from '../meetings/next-meeting.js';
import { OverviewService } from '../overview/overview.service.js';
import { PortfolioService } from '../portfolio/portfolio.service.js';
import { readDecisions } from '../ratings/consolidation.js';
import { RatingsService } from '../ratings/ratings.service.js';
import { PlanApprovalsService } from '../supplier-plans/plan-approvals.service.js';
import { PlanContributionsService } from '../supplier-plans/plan-contributions.service.js';

const limit = 5;

const toNext = (row: {
  id: string;
  relationshipId: string;
  title: string;
  startsAt: Date;
  location: string | null;
}) => ({
  id: row.id,
  relationshipId: row.relationshipId,
  title: row.title,
  startsAt: row.startsAt.toISOString(),
  location: row.location,
});

/** Start (NAV-05): liest nur, speichert nichts. Aufgaben kommen von den Modulen. */
@Injectable()
export class StartService {
  constructor(
    @Inject(RatingsService) private readonly ratings: RatingsService,
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(OverviewService) private readonly overviews: OverviewService,
    @Inject(PlanContributionsService) private readonly contributions: PlanContributionsService,
    @Inject(CustomersService) private readonly customers: CustomersService,
    @Inject(ActionsService) private readonly actions: ActionsService,
    @Inject(PlanApprovalsService) private readonly approvals: PlanApprovalsService,
    @Inject(PortfolioService) private readonly portfolio: PortfolioService,
  ) {}

  /** Alle Aufgaben der Person, nach Frist sortiert. Weitere Module melden sich hier an. */
  private async dueItems(auth: AuthContext): Promise<DueItem[]> {
    const subject = {
      orgRole: auth.orgRole,
      isControlling: auth.isControlling,
      isOperator: auth.isOperator,
    };
    const ratings =
      can(subject, 'bewertungen.sehen') && auth.organization?.buyer
        ? await this.ratings.dueItems(auth)
        : [];
    const cycles =
      can(subject, 'lieferanten.sehen') && auth.organization?.buyer
        ? await this.overviews.overdueItems(auth)
        : [];
    const contributions = await this.contributions.dueItems(auth);
    // QBR-03: offene Maßnahmen, für die die Person verantwortlich ist (beide Seiten).
    const actions = await this.actions.dueItems(auth);
    // SPL-07: Freigaben des Lieferantenplans, über die die Person noch entscheidet.
    const approvals = await this.approvals.dueItems(auth);
    const items = [...ratings, ...cycles, ...contributions, ...actions, ...approvals];
    return items.sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || a.supplier.localeCompare(b.supplier),
    );
  }

  async due(auth: AuthContext): Promise<DueList> {
    return dueListSchema.parse({ items: await this.dueItems(auth) });
  }

  /**
   * Nächster Termin (QBR-01b) aus den Beziehungen der Person: beim Käufer die, in deren Team sie
   * ist, beim Lieferanten alle Kunden, je im Kontext des Kunden.
   */
  private async nextMeeting(auth: AuthContext): Promise<NextMeeting | null> {
    const organization = auth.organization;
    const subject = {
      orgRole: auth.orgRole,
      isControlling: auth.isControlling,
      isOperator: auth.isOperator,
    };
    if (organization && !organization.buyer && can(subject, 'kunden.sehen')) {
      let next: NextMeeting | null = null;
      for (const customer of await this.customers.customersOf(auth)) {
        const row = await this.customers.nextMeeting(auth, customer);
        if (row && (!next || row.startsAt.toISOString() < next.startsAt)) {
          next = { ...toNext(row), counterpart: customer.name };
        }
      }
      return next;
    }
    if (!organization?.buyer || !can(subject, 'termine.sehen')) return null;
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const own = await tx
          .select({ id: schema.relationshipMember.relationshipId })
          .from(schema.relationshipMember)
          .where(
            and(
              eq(schema.relationshipMember.orgId, organization.id),
              eq(schema.relationshipMember.userId, auth.userId),
            ),
          );
        const row = await nextMeetingOf(
          tx,
          own.map((entry) => entry.id),
        );
        if (!row) return null;
        const [named] = await tx
          .select({
            name: sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`,
          })
          .from(schema.relationship)
          .innerJoin(
            schema.organization,
            eq(schema.organization.id, schema.relationship.supplierOrgId),
          )
          .leftJoin(
            schema.relationshipSide,
            and(
              eq(schema.relationshipSide.relationshipId, schema.relationship.id),
              eq(schema.relationshipSide.orgId, organization.id),
            ),
          )
          .where(eq(schema.relationship.id, row.relationshipId));
        return { ...toNext(row), counterpart: named?.name ?? '' };
      },
      { readOnly: true },
    );
  }

  private async relationships(auth: AuthContext) {
    const organization = auth.organization;
    const subject = {
      orgRole: auth.orgRole,
      isControlling: auth.isControlling,
      isOperator: auth.isOperator,
    };
    // Lieferantenseite (LIF-02): die eigenen Kunden, je mit Namen; ohne Soll-Typ des Käufers.
    if (organization && !organization.buyer && can(subject, 'kunden.sehen')) {
      const customers = await this.customers.customersOf(auth);
      return {
        items: customers
          .slice(0, limit)
          .map((customer) => ({ id: customer.relationshipId, name: customer.name, target: null })),
        total: customers.length,
      };
    }
    if (!organization?.buyer || !can(subject, 'lieferanten.sehen')) {
      return { items: [], total: 0 };
    }
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const name = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;
      const rows = await tx
        .select({ id: schema.relationship.id, name })
        .from(schema.relationshipMember)
        .innerJoin(
          schema.relationship,
          eq(schema.relationship.id, schema.relationshipMember.relationshipId),
        )
        .innerJoin(
          schema.organization,
          eq(schema.organization.id, schema.relationship.supplierOrgId),
        )
        .leftJoin(
          schema.relationshipSide,
          and(
            eq(schema.relationshipSide.relationshipId, schema.relationship.id),
            eq(schema.relationshipSide.orgId, organization.id),
          ),
        )
        .where(
          and(
            eq(schema.relationshipMember.orgId, organization.id),
            eq(schema.relationshipMember.userId, auth.userId),
            eq(schema.relationship.status, 'active'),
          ),
        )
        .orderBy(asc(name));
      const items = [];
      for (const row of rows.slice(0, limit)) {
        const total = (await readDecisions(tx, organization.id, row.id))[0]?.entries.find(
          (entry) => entry.scope === 'total',
        );
        items.push({ ...row, target: total?.soll.typeName ?? null });
      }
      return { items, total: rows.length };
    });
  }

  async overview(auth: AuthContext): Promise<StartData> {
    const due = await this.dueItems(auth);
    return startSchema.parse({
      due: { items: due.slice(0, limit), total: due.length },
      relationships: await this.relationships(auth),
      nextMeeting: await this.nextMeeting(auth),
      portfolio:
        auth.organization?.buyer && can(auth, 'portfolio.sehen')
          ? await this.portfolio.startSummary(auth)
          : null,
      openActions: (await this.actions.mine(auth)).items.length,
    });
  }
}
