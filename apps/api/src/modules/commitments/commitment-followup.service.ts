import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, currentTime, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import { offsetCycleDate, type UserLocale } from '@reziproq/shared';
import { AccountStore, ActionDueStore, TenantDatabase } from '../../common/database.module.js';
import { inOrgClock } from '../../common/org-clock.js';
import { workerEnabled, workerLevelFor } from '../agents/worker-levels.js';
import { EmailService } from '../email/email.service.js';
import { berlinDate } from '../today/berlin.js';
import { recordDone } from '../today/erledigt.js';

// ZQ-01 Regel 5 (K2-b.6, E-K1-5, T2-ZQ3): Die Aufgabe „Zusagen nachhalten“ prüft täglich die
// fälligen Zusagen des Lieferanten und erinnert ihn daran, gekennzeichnet als Nachricht von
// Reziproq im Auftrag des Kunden. Sie handelt für die verantwortliche Person des Käufers (SRO) auf
// Stufe Erledigen; der Lauf steht in deren Erledigt. Jede Seite bleibt in ihrer Mandanten-Session:
// Der Käufer sieht seine Zusagen und sein Team, der Lieferant liest die Adressen seiner Leute selbst
// (im Kontext seines Kunden) und legt die Mail in seine Outbox. Auf der Stufe Vorbereiten oder
// Vorschlagen wirkt die Aufgabe noch nicht (liveLevels), und das Buchen als gehalten mit Beleg
// kommt mit seinem Paket.

const systemUser = 'system:commitment-followup';
const workerKey = 'commitment_followup';
/** Eine weitere Erinnerung an dieselbe Zusage frühestens nach sieben Tagen */
const repeatDays = 7;

interface Candidate extends Record<string, unknown> {
  id: string;
  relationship_id: string;
  supplier_org_id: string;
  title: string;
  due_on: string;
  owner_user_id: string | null;
  sro: string | null;
}

interface Recipient {
  email: string;
  name: string;
  locale: UserLocale;
  firstName: string | null;
}

const formatDate = (date: string, locale: UserLocale) =>
  new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

@Injectable()
export class CommitmentFollowupService {
  private readonly logger = new Logger(CommitmentFollowupService.name);

  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(ActionDueStore) private readonly store: ActionDueStore,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(EmailService) private readonly emails: EmailService,
  ) {}

  /**
   * Ein Durchlauf über die Käufer mit aktiven Beziehungen, ohne Demo-Mandanten (E-K2-11); für die
   * Demo-Regie und Tests mit ausdrücklichen Organisationen. Gibt die Zahl der Erinnerungen zurück.
   */
  async runDaily(organizationIds?: string[]): Promise<number> {
    const organizations = organizationIds ?? (await this.store.hintOrganizations());
    let sent = 0;
    for (const orgId of organizations) {
      sent += await inOrgClock(this.accounts, orgId, () => this.processOrganization(orgId));
    }
    return sent;
  }

  /** Ein Käufer: fällige Zusagen seiner Lieferanten, je eine Erinnerung */
  async processOrganization(buyerOrgId: string): Promise<number> {
    const plan = await this.tenant.run(
      { userId: systemUser, organizationId: buyerOrgId },
      async (tx) => {
        if (!(await workerEnabled(tx, buyerOrgId, workerKey))) return null;
        const today = berlinDate(currentTime());
        const [buyer] = await tx
          .select({ name: schema.organization.name })
          .from(schema.organization)
          .where(eq(schema.organization.id, buyerOrgId));
        // Fällig: Frist verstrichen, offen, von beiden Seiten bestätigt (ZQ-01 Regel 2)
        const candidates = await tx.execute<Candidate>(sql`
          select c.id, c.relationship_id, r.supplier_org_id, c.title, c.due_on::text as due_on,
            c.owner_user_id,
            (select m.user_id from relationship_member m
              where m.relationship_id = r.id and m.org_id = ${buyerOrgId} and m.team_role = 'sro'
              order by m.user_id limit 1) as sro
          from commitment c
          join relationship r on r.id = c.relationship_id
          where r.buyer_org_id = ${buyerOrgId} and r.status = 'active'
            and c.side = 'supplier' and c.status = 'open' and c.confirm_state = 'both_confirmed'
            and c.due_on < ${today}::date
          order by c.due_on, c.id`);
        return {
          today,
          buyerName: buyer?.name ?? '',
          // Ohne verantwortliche Person beim Käufer handelt Reziproq für niemanden
          candidates: candidates.rows.filter((row) => row.sro !== null),
        };
      },
      { readOnly: true },
    );
    if (!plan) return 0;

    let sent = 0;
    for (const candidate of plan.candidates) {
      try {
        if (await this.remind(buyerOrgId, plan.buyerName, plan.today, candidate)) sent += 1;
      } catch (error) {
        this.logger.warn(
          `Zusagen nachhalten ${candidate.id}: ${error instanceof Error ? error.message : 'Fehler'}`,
        );
      }
    }
    return sent;
  }

  /**
   * Eine Zusage: Stufe der verantwortlichen Person prüfen, beim Lieferanten erinnern und den Lauf in
   * Erledigt festhalten. Nichts geschieht, wenn in den letzten sieben Tagen schon erinnert wurde,
   * heute schon eine andere Erinnerung an diese Zusage ging (keine zwei Mails an einem Tag) oder
   * beim Lieferanten niemand zuständig ist.
   */
  private async remind(
    buyerOrgId: string,
    buyerName: string,
    today: string,
    candidate: Candidate,
  ): Promise<boolean> {
    const sro = candidate.sro;
    if (!sro) return false;
    const level = await this.tenant.run(
      { userId: sro, organizationId: buyerOrgId },
      (tx) => workerLevelFor(tx, { orgId: buyerOrgId, userId: sro }, workerKey),
      { readOnly: true },
    );
    if (level !== 'do') return false;

    const recipient = await this.tenant.run(
      {
        userId: systemUser,
        organizationId: candidate.supplier_org_id,
        customerOrganizationId: buyerOrgId,
      },
      async (tx) => {
        const recent = await tx.execute(sql`
          select 1 from reminder_sent s
          where s.org_id = ${candidate.supplier_org_id} and s.object_type = 'commitment'
            and s.object_id = ${candidate.id}
            and ((s.kind = 'followup' and s.due_date > ${offsetCycleDate(today, -repeatDays)}::date)
              or (s.sent_at at time zone 'Europe/Berlin')::date = ${today}::date)
          limit 1`);
        if (recent.rows.length > 0) return null;
        const person =
          (candidate.owner_user_id ? await this.person(tx, candidate.owner_user_id) : null) ??
          (await this.lead(tx, candidate.relationship_id, candidate.supplier_org_id));
        if (!person) return null;
        const [sentRow] = await tx
          .insert(schema.reminderSent)
          .values({
            objectType: 'commitment',
            objectId: candidate.id,
            relationshipId: candidate.relationship_id,
            orgId: candidate.supplier_org_id,
            kind: 'followup',
            dueDate: today,
          })
          .onConflictDoNothing()
          .returning({ id: schema.reminderSent.id });
        if (!sentRow) return null;
        await this.queue(tx, candidate, sentRow.id, {
          template: 'commitment_followup',
          locale: person.locale,
          recipient: person.email,
          ...(person.firstName ? { firstName: person.firstName } : {}),
          title: candidate.title.slice(0, 140),
          deadline: formatDate(candidate.due_on, person.locale),
          link: `/kunden/${candidate.relationship_id}/umsetzung/massnahmen`,
          ...(buyerName ? { sender: buyerName.slice(0, 120) } : {}),
        });
        return person;
      },
    );
    if (!recipient) return false;

    await this.tenant.run({ userId: systemUser, organizationId: buyerOrgId }, (tx) =>
      recordDone(tx, {
        orgId: buyerOrgId,
        userId: sro,
        workerKey,
        relationshipId: candidate.relationship_id,
        contextType: 'commitment',
        contextId: candidate.id,
        undo: {
          kind: 'commitment_remind',
          commitmentId: candidate.id,
          title: candidate.title,
          relationshipId: candidate.relationship_id,
          dueOn: candidate.due_on,
          recipient: recipient.name,
        },
      }),
    );
    return true;
  }

  /** Eine Person der eigenen Organisation (RLS der Lieferanten-Session) */
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
      name: row.name,
      locale: row.locale ?? 'de',
      firstName: row.givenName ?? row.name.split(' ')[0] ?? null,
    };
  }

  /** Key Account Manager des Lieferanten (Teamrolle sro seiner Seite), wenn niemand genannt ist */
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

  /** Verlauf des Lieferanten mit „Reziproq“ als Absender und die Mail in seiner Outbox */
  private async queue(
    tx: TenantTransaction,
    candidate: Candidate,
    reminderId: string,
    input: Record<string, unknown>,
  ) {
    const [event] = await tx
      .insert(schema.auditEvent)
      .values({
        actorUserId: systemUser,
        actorName: 'Reziproq',
        ownerOrgId: candidate.supplier_org_id,
        visibility: 'internal',
        relationshipId: candidate.relationship_id,
        objectType: 'reminder_sent',
        objectId: reminderId,
        action: 'created',
        changes: { kind: { from: null, to: 'followup' } },
      })
      .returning({ id: schema.auditEvent.id });
    if (!event) throw new Error('Verlaufseintrag der Erinnerung fehlt');
    const email = this.emails.prepare(input);
    await tx.insert(schema.outboxEvent).values({
      eventType: 'email.followup',
      objectType: 'reminder_sent',
      objectId: reminderId,
      auditEventId: event.id,
      orgId: candidate.supplier_org_id,
      emailTemplate: email.template,
      emailLocale: email.locale,
      emailRecipient: email.recipient,
      emailFirstName: email.firstName ?? null,
      emailTitle: email.title,
      emailDeadline: email.deadline ?? null,
      emailLink: email.link,
      emailSender: email.sender ?? null,
    });
  }
}
