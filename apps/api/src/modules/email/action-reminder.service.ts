import { Inject, Injectable } from '@nestjs/common';
import { and, currentTime, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import { offsetCycleDate, type UserLocale } from '@reziproq/shared';
import { ActionDueStore, TenantDatabase } from '../../common/database.module.js';
import { readReminderDays } from '../actions/action-settings.js';
import { EmailService } from './email.service.js';

const systemUser = 'system:action-reminders';
/** Größte einstellbare Zahl an Erinnerungstagen (actionReminderSettingSchema). */
const maxReminderDays = 30;

type Kind = 'reminder' | 'escalation';
interface Recipient {
  email: string;
  locale: UserLocale;
  firstName: string | null;
}

const formatDate = (date: string, locale: UserLocale) =>
  new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

/**
 * QBR-04: täglich Erinnerung vor der Frist und Eskalation am Tag danach. Jede Organisation läuft in
 * ihrer eigenen Mandanten-Session (der Lieferant im Kontext seines Kunden); sie sieht nur, was RLS
 * ihr zeigt, und schreibt nur an Personen ihrer Seite. Interne Maßnahmen der anderen Seite bleiben
 * damit unsichtbar. action_notification verhindert doppelte Mails je Frist.
 */
@Injectable()
export class ActionReminderService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(ActionDueStore) private readonly due: ActionDueStore,
    @Inject(EmailService) private readonly emails: EmailService,
  ) {}

  async runDaily(today = currentTime().toISOString().slice(0, 10)): Promise<number> {
    let queued = 0;
    const from = offsetCycleDate(today, -1);
    const to = offsetCycleDate(today, maxReminderDays);
    for (const { orgId, customerOrgId } of await this.due.organizations(from, to)) {
      queued += await this.processOrganization(orgId, customerOrgId, today);
    }
    return queued;
  }

  async processOrganization(
    orgId: string,
    customerOrgId: string | null,
    today: string,
  ): Promise<number> {
    const session = {
      userId: systemUser,
      organizationId: orgId,
      customerOrganizationId: customerOrgId,
    };
    return this.tenant.run(session, async (tx) => {
      const side = customerOrgId ? 'supplier' : 'buyer';
      const days = await readReminderDays(tx, orgId);
      const dates: Record<Kind, string> = {
        reminder: offsetCycleDate(today, days),
        escalation: offsetCycleDate(today, -1),
      };
      // ZQ-01 (K2-a.3): früher Maßnahmen; jetzt offene Zusagen der eigenen Seite (wer zusagt) und
      // die eigenen offenen Aufgaben
      const ofRelationship =
        side === 'buyer'
          ? sql`r.buyer_org_id = ${orgId}`
          : sql`r.supplier_org_id = ${orgId} and r.buyer_org_id = ${customerOrgId}`;
      const dueDays = sql`(${dates.reminder}::date, ${dates.escalation}::date)`;
      const actions = (
        await tx.execute<{
          objectType: 'commitment' | 'task';
          id: string;
          relationshipId: string;
          title: string;
          dueDate: string;
          ownerUserId: string | null;
        }>(sql`
          select 'commitment' as "objectType", c.id, c.relationship_id as "relationshipId",
            c.title, c.due_on::text as "dueDate", c.owner_user_id as "ownerUserId"
          from commitment c join relationship r on r.id = c.relationship_id
          where c.status = 'open' and c.side = ${side} and c.due_on in ${dueDays}
            and r.status = 'active' and ${ofRelationship}
          union all
          select 'task', t.id, t.relationship_id, t.title, t.due_date::text, t.owner_user_id
          from task t join relationship r on r.id = t.relationship_id
          where t.status in ('open', 'in_progress') and t.org_id = ${orgId}
            and t.due_date in ${dueDays} and r.status = 'active' and ${ofRelationship}`)
      ).rows;

      let queued = 0;
      for (const action of actions) {
        for (const kind of ['reminder', 'escalation'] as const) {
          if (action.dueDate !== dates[kind]) continue;
          const [sent] = await tx
            .insert(schema.reminderSent)
            .values({
              objectType: action.objectType,
              objectId: action.id,
              relationshipId: action.relationshipId,
              orgId,
              kind,
              dueDate: action.dueDate,
            })
            .onConflictDoNothing()
            .returning({ id: schema.reminderSent.id });
          if (!sent) continue;

          const owner = action.ownerUserId ? await this.person(tx, action.ownerUserId) : null;
          // Eskalation an SRO bzw. Key Account Manager, die verantwortliche Person in Kopie.
          const recipients =
            kind === 'reminder'
              ? [owner]
              : [await this.lead(tx, action.relationshipId, orgId), owner];
          const unique = recipients
            .filter((recipient): recipient is Recipient => recipient !== null)
            .filter(
              (recipient, index, all) =>
                all.findIndex((r) => r.email === recipient.email) === index,
            );
          const link =
            side === 'buyer'
              ? `/lieferanten/${action.relationshipId}/umsetzung/massnahmen`
              : `/kunden/${action.relationshipId}/umsetzung/massnahmen`;
          for (const recipient of unique) {
            await this.queue(tx, orgId, action.relationshipId, sent.id, kind, {
              template: kind,
              locale: recipient.locale,
              recipient: recipient.email,
              ...(recipient.firstName ? { firstName: recipient.firstName } : {}),
              title: action.title.slice(0, 140),
              deadline: formatDate(action.dueDate, recipient.locale),
              link,
            });
            queued += 1;
          }
        }
      }
      return queued;
    });
  }

  /** Eine Person der eigenen Organisation (RLS); Personen ohne Konto gibt es hier nicht. */
  private async person(tx: TenantTransaction, userId: string): Promise<Recipient | null> {
    const [row] = await tx
      .select({
        email: schema.appUser.email,
        locale: schema.appUser.locale,
        name: schema.appUser.name,
        givenName: schema.appUser.givenName,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, userId));
    if (!row) return null;
    return {
      email: row.email,
      locale: row.locale ?? 'de',
      firstName: row.givenName ?? row.name.split(' ')[0] ?? null,
    };
  }

  /** SRO beim Käufer, Key Account Manager beim Lieferanten: Teamrolle sro der eigenen Seite. */
  private async lead(tx: TenantTransaction, relationshipId: string, orgId: string) {
    const [member] = await tx
      .select({ userId: schema.relationshipMember.userId })
      .from(schema.relationshipMember)
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, relationshipId),
          eq(schema.relationshipMember.orgId, orgId),
          eq(schema.relationshipMember.teamRole, 'sro'),
        ),
      );
    return member ? this.person(tx, member.userId) : null;
  }

  private async queue(
    tx: TenantTransaction,
    orgId: string,
    relationshipId: string,
    notificationId: string,
    kind: Kind,
    input: Record<string, unknown>,
  ) {
    const [event] = await tx
      .insert(schema.auditEvent)
      .values({
        actorUserId: systemUser,
        actorName: 'Reziproq',
        ownerOrgId: orgId,
        visibility: 'internal',
        relationshipId,
        objectType: 'reminder_sent',
        objectId: notificationId,
        action: 'created',
        changes: { kind: { from: null, to: kind } },
      })
      .returning({ id: schema.auditEvent.id });
    if (!event) throw new Error('Verlaufseintrag für Maßnahmen-Mail fehlt');
    const email = this.emails.prepare(input);
    await tx.insert(schema.outboxEvent).values({
      eventType: `email.${kind}`,
      objectType: 'reminder_sent',
      objectId: notificationId,
      auditEventId: event.id,
      orgId,
      emailTemplate: email.template,
      emailLocale: email.locale,
      emailRecipient: email.recipient,
      emailFirstName: email.firstName ?? null,
      emailTitle: email.title,
      emailDeadline: email.deadline ?? null,
      emailLink: email.link,
    });
  }
}
