import { Inject, Injectable } from '@nestjs/common';
import { and, currentTime, desc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import { calculateCycleDeadlines, offsetCycleDate, type UserLocale } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import {
  CYCLE_STEP_SOURCES,
  type CycleStepSource,
  readActiveCycle,
  readCycleSettings,
} from '../overview/cycle.js';
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

  async runDaily(today = currentTime().toISOString().slice(0, 10)): Promise<number> {
    let queued = 0;
    for (const organizationId of await this.outbox.reminderOrganizations()) {
      queued += await this.processOrganization(organizationId, today);
    }
    return queued;
  }

  async processOrganization(organizationId: string, today: string): Promise<number> {
    return this.tenant.run({ userId: 'system:cycle-reminders', organizationId }, async (tx) => {
      const rows = await tx
        .select({
          cycleId: schema.cycle.id,
          relationshipId: schema.cycle.relationshipId,
          jbpDate: schema.cycle.jbpDate,
          sroEmail: schema.appUser.email,
          sroLocale: schema.appUser.locale,
        })
        .from(schema.cycle)
        .innerJoin(schema.relationship, eq(schema.relationship.id, schema.cycle.relationshipId))
        .innerJoin(
          schema.relationshipMember,
          and(
            eq(schema.relationshipMember.relationshipId, schema.relationship.id),
            eq(schema.relationshipMember.orgId, organizationId),
            eq(schema.relationshipMember.teamRole, 'sro'),
          ),
        )
        .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
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
          // JBP-07: Bei der Scorecard geht die Erinnerung an die Seite, die noch nicht
          // unterschrieben hat; sonst an den SRO.
          const recipients =
            deadline.step === 'scorecard'
              ? await this.scorecardRecipients(tx, row.relationshipId, row.sroEmail, locale)
              : [{ email: row.sroEmail, locale, link: `/lieferanten/${row.relationshipId}` }];
          for (const recipient of recipients) {
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
              locale: recipient.locale,
              recipient: recipient.email,
              title: stepTitles[recipient.locale][deadline.step] ?? title,
              link: recipient.link,
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
      }
      return queued;
    });
  }

  /**
   * Empfänger der Scorecard-Erinnerung (JBP-07): der SRO, wenn der Käufer noch nicht unterschrieben
   * hat; die Personen des Lieferanten mit angenommener Einladung, wenn der Lieferant noch fehlt.
   * Beides kennt der Käufer selbst; Adressen der anderen Seite liest die Erinnerung nicht.
   */
  private async scorecardRecipients(
    tx: TenantTransaction,
    relationshipId: string,
    sroEmail: string,
    locale: UserLocale,
  ) {
    const [plan] = await tx
      .select({ id: schema.jbp.id })
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.version))
      .limit(1);
    const [card] = plan
      ? await tx.select().from(schema.scorecard).where(eq(schema.scorecard.jbpId, plan.id))
      : [];
    const signed = card
      ? await tx
          .select({ side: schema.scorecardSignature.side })
          .from(schema.scorecardSignature)
          .where(
            and(
              eq(schema.scorecardSignature.scorecardId, card.id),
              eq(schema.scorecardSignature.version, card.version),
            ),
          )
      : [];
    const recipients: { email: string; locale: UserLocale; link: string }[] = [];
    if (!signed.some((entry) => entry.side === 'buyer')) {
      recipients.push({
        email: sroEmail,
        locale,
        link: `/lieferanten/${relationshipId}/plan/scorecard`,
      });
    }
    if (card && !signed.some((entry) => entry.side === 'supplier')) {
      const invited = await tx
        .select({ email: schema.invitation.email })
        .from(schema.invitation)
        .where(
          and(
            eq(schema.invitation.relationshipId, relationshipId),
            sql`${schema.invitation.acceptedUserId} is not null`,
            sql`${schema.invitation.revokedAt} is null`,
          ),
        );
      for (const entry of invited) {
        recipients.push({
          email: entry.email,
          locale: 'de',
          link: `/kunden/${relationshipId}/plan/scorecard/unterschreiben`,
        });
      }
    }
    return recipients;
  }
}
