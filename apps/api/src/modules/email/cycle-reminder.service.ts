import { Inject, Injectable } from '@nestjs/common';
import { and, eq, schema, sql } from '@reziproq/db';
import {
  calculateCycleDeadlines,
  offsetCycleDate,
  type UserLocale,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { readActiveCycle, readCycleSettings } from '../overview/cycle.js';
import { CYCLE_STEP_SOURCES, type CycleStepSource } from '../overview/cycle.js';
import { EmailService } from './email.service.js';
import type { EmailOutboxStore } from './email.types.js';
import { EMAIL_OUTBOX_STORE } from './email.types.js';

const stepTitles: Record<UserLocale, Record<string, string>> = {
  de: {
    feedback: 'Feedback',
    touchpoints: 'Kontaktpunkte',
    supplierPlan: 'Lieferantenplan',
    jbp: 'Gemeinsamer Plan',
    scorecard: 'Scorecard',
  },
  en: {
    feedback: 'Feedback',
    touchpoints: 'Touchpoints',
    supplierPlan: 'Supplier plan',
    jbp: 'Joint Business Plan',
    scorecard: 'Scorecard',
  },
};

@Injectable()
export class CycleReminderService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(EMAIL_OUTBOX_STORE) private readonly outbox: EmailOutboxStore,
    @Inject(EmailService) private readonly emails: EmailService,
    @Inject(CYCLE_STEP_SOURCES) private readonly cycleSteps: CycleStepSource[],
  ) {}

  async runDaily(today = new Date().toISOString().slice(0, 10)): Promise<number> {
    let queued = 0;
    for (const organizationId of await this.outbox.reminderOrganizations()) {
      queued += await this.processOrganization(organizationId, today);
    }
    return queued;
  }

  async processOrganization(organizationId: string, today: string): Promise<number> {
    return this.tenant.run(
      { userId: 'system:cycle-reminders', organizationId },
      async (tx) => {
        const rows = await tx
          .select({
            cycleId: schema.cycle.id,
            relationshipId: schema.cycle.relationshipId,
            jbpDate: schema.cycle.jbpDate,
            sroEmail: schema.appUser.email,
            sroLocale: schema.appUser.locale,
          })
          .from(schema.cycle)
          .innerJoin(
            schema.relationship,
            eq(schema.relationship.id, schema.cycle.relationshipId),
          )
          .innerJoin(
            schema.relationshipMember,
            and(
              eq(schema.relationshipMember.relationshipId, schema.relationship.id),
              eq(schema.relationshipMember.orgId, organizationId),
              eq(schema.relationshipMember.teamRole, 'sro'),
            ),
          )
          .innerJoin(
            schema.appUser,
            eq(schema.appUser.id, schema.relationshipMember.userId),
          )
          .where(
            and(
              eq(schema.cycle.status, 'active'),
              eq(schema.relationship.buyerOrgId, organizationId),
              eq(schema.relationship.status, 'active'),
              sql`${schema.cycle.jbpDate} is not null`,
            ),
          );
        const settings = await readCycleSettings(tx);
        let queued = 0;

        for (const row of rows) {
          if (!row.jbpDate) continue;
          const cycle = await readActiveCycle(tx, row.relationshipId, this.cycleSteps);
          if (!cycle) continue;
          const cycleDeadlines = calculateCycleDeadlines(row.jbpDate, settings);

          for (const deadline of cycleDeadlines) {
            if (!deadline.dueDate) continue;
            if (
              offsetCycleDate(deadline.dueDate, -deadline.reminderDaysBefore) !== today ||
              cycle.steps.find((step) => step.key === deadline.step)?.status === 'completed'
            ) {
              continue;
            }

            const [sent] = await tx
              .insert(schema.cycleReminderSent)
              .values({
                cycleId: row.cycleId,
                relationshipId: row.relationshipId,
                step: deadline.step,
                dueDate: deadline.dueDate,
              })
              .onConflictDoNothing()
              .returning({ id: schema.cycleReminderSent.id });
            if (!sent) continue;

            const locale = row.sroLocale ?? 'de';
            const title = stepTitles[locale][deadline.step];
            const [event] = await tx
              .insert(schema.auditEvent)
              .values({
                actorUserId: 'system:cycle-reminders',
                actorName: 'Reziproq',
                ownerOrgId: organizationId,
                visibility: 'internal',
                relationshipId: row.relationshipId,
                objectType: 'cycle_reminder',
                objectId: sent.id,
                action: 'created',
              })
              .returning({ id: schema.auditEvent.id });
            if (!event) throw new Error('Verlaufseintrag für Zykluserinnerung fehlt');

            const email = this.emails.prepare({
              template: 'reminder',
              locale,
              recipient: row.sroEmail,
              title,
              link: `/lieferanten/${row.relationshipId}`,
            });
            await tx.insert(schema.outboxEvent).values({
              eventType: 'email.reminder',
              objectType: 'cycle_reminder',
              objectId: sent.id,
              auditEventId: event.id,
              orgId: organizationId,
              emailTemplate: email.template,
              emailLocale: email.locale,
              emailRecipient: email.recipient,
              emailTitle: email.title,
              emailLink: email.link,
            });
            queued += 1;
          }
        }
        return queued;
      },
    );
  }
}
