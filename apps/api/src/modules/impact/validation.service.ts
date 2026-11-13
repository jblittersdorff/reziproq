import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { auditedChange, desc, eq, schema, type TenantTransaction } from '@reziproq/db';
import {
  type DecideValidation,
  type DueItem,
  type Lever,
  type ValidationDetail,
  type ValidationList,
  validationDetailSchema,
  validationListSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { maturityAudit, validationAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { EmailService } from '../email/email.service.js';
import { maturityOf } from './maturity.js';
import { monthsOf, recompute, validationsOf } from './values.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });

/** Tage, die Controlling für eine Prüfung hat (Aufgabe auf Start). */
const reviewDays = 7;

/**
 * PNL-06: Freigabe der Wirkung durch Controlling. Nur Personen mit der Zusatzrolle Controlling
 * entscheiden; die Freigabe sperrt die Monate des Zeitraums und hebt die Initiative auf R5,
 * Zurückweisen verlangt eine Begründung und benachrichtigt den SRO.
 */
@Injectable()
export class ValidationService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  private run<T>(auth: AuthContext, work: (tx: TenantTransaction, orgId: string) => Promise<T>) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization.id),
    );
  }

  list(auth: AuthContext): Promise<ValidationList> {
    return this.run(auth, async (tx) =>
      validationListSchema.parse({
        validations: await validationsOf(tx, {}),
        canDecide: can(auth, 'wirkung.freigeben'),
      }),
    );
  }

  private async load(tx: TenantTransaction, auth: AuthContext, id: string) {
    const [validation] = await validationsOf(tx, { id });
    if (!validation) throw notFound();
    const [impact] = await tx
      .select()
      .from(schema.initiativeImpact)
      .where(eq(schema.initiativeImpact.initiativeId, validation.initiativeId))
      .orderBy(desc(schema.initiativeImpact.updatedAt))
      .limit(1);
    if (!impact) throw notFound();
    const [line] = await tx
      .select({ name: schema.pnlLine.name })
      .from(schema.pnlLine)
      .where(eq(schema.pnlLine.key, impact.pnlLineKey))
      .limit(1);
    const [baseline] = await tx
      .select()
      .from(schema.initiativeBaseline)
      .where(eq(schema.initiativeBaseline.initiativeId, validation.initiativeId))
      .orderBy(desc(schema.initiativeBaseline.version))
      .limit(1);
    const { months, totals } = await monthsOf(tx, validation.initiativeId, {
      from: validation.periodFrom,
      to: validation.periodTo,
    });
    return validationDetailSchema.parse({
      validation,
      impact: {
        lever: impact.lever as Lever,
        leverTemplateVersion: impact.leverTemplateVersion,
        pnlLine: { key: impact.pnlLineKey, name: line?.name ?? impact.pnlLineKey },
        effectType: impact.effectType,
        effectiveFrom: impact.effectiveFrom,
      },
      baseline: baseline
        ? {
            version: baseline.version,
            leverTemplateVersion: baseline.leverTemplateVersion,
            inputs: baseline.inputs,
            frozenAt: baseline.frozenAt.toISOString(),
            frozenByName: baseline.frozenByName,
            changeReason: baseline.changeReason,
          }
        : null,
      months,
      totals,
      maturity: await maturityOf(tx, validation.initiativeId),
      canDecide: validation.status === 'requested' && can(auth, 'wirkung.freigeben'),
    });
  }

  detail(auth: AuthContext, id: string): Promise<ValidationDetail> {
    return this.run(auth, (tx) => this.load(tx, auth, id));
  }

  decide(auth: AuthContext, id: string, input: DecideValidation): Promise<ValidationDetail> {
    if (!can(auth, 'wirkung.freigeben')) throw forbidden();
    return this.run(auth, async (tx, orgId) => {
      const detail = await this.load(tx, auth, id);
      const { validation } = detail;
      if (validation.status !== 'requested') throw conflict('nicht_offen');
      const actor = await actorOf(tx, auth, orgId);
      if (input.decision === 'approved') {
        // R5 nur mit Ist-Werten im Zeitraum und von R4 aus.
        if (!detail.months.some((month) => month.actual)) throw conflict('keine_ist_werte');
        if (detail.maturity.level !== 4) throw conflict('erst_ab_r4');
      }
      await auditedChange(tx, actor, validationAudit, async () => {
        await tx
          .update(schema.initiativeValidation)
          .set({
            status: input.decision,
            decidedBy: auth.userId,
            decidedByName: actor.name,
            decidedAt: new Date(),
            comment: input.comment,
          })
          .where(eq(schema.initiativeValidation.id, id));
        return {
          objectId: id,
          relationshipId: validation.relationshipId,
          action: input.decision === 'approved' ? ('approved' as const) : ('updated' as const),
          before: { status: 'requested', period: null, comment: null },
          after: {
            status: input.decision,
            period: `${validation.periodFrom} – ${validation.periodTo}`,
            comment: input.comment,
          },
          result: undefined,
        };
      });
      if (input.decision === 'approved') {
        await auditedChange(tx, actor, maturityAudit, async () => {
          await tx.insert(schema.maturityStep).values({
            relationshipId: validation.relationshipId,
            ownerOrgId: orgId,
            visibility: 'shared',
            initiativeId: validation.initiativeId,
            fromLevel: 4,
            toLevel: 5,
            // Teilbar formuliert: realisiert und bestätigt, ohne Details der Prüfung.
            evidence: 'Realisiert und durch Controlling bestätigt',
            decidedBy: auth.userId,
            decidedByName: actor.name,
          });
          return {
            objectId: validation.initiativeId,
            relationshipId: validation.relationshipId,
            action: 'updated' as const,
            before: { level: 'R4', evidence: null },
            after: { level: 'R5', evidence: 'Realisiert und durch Controlling bestätigt' },
            result: undefined,
          };
        });
        await recompute(tx, validation.initiativeId);
      } else {
        // Zurückgewiesen: Der SRO, der angefordert hat, bekommt eine Mail.
        const [requester] = await tx
          .select({
            email: schema.appUser.email,
            name: schema.appUser.name,
            locale: schema.appUser.locale,
            id: schema.appUser.id,
          })
          .from(schema.appUser)
          .innerJoin(
            schema.initiativeValidation,
            eq(schema.initiativeValidation.requestedBy, schema.appUser.id),
          )
          .where(eq(schema.initiativeValidation.id, id));
        if (requester?.email) {
          const email = requester.email;
          await auditedChange(tx, actor, validationAudit, async () => ({
            objectId: `${id}:${requester.id}`,
            relationshipId: validation.relationshipId,
            action: 'created' as const,
            after: { status: 'rejected', period: null, comment: null },
            result: undefined,
            email: this.email.prepare({
              recipient: email,
              template: 'escalation',
              locale: requester.locale ?? 'de',
              firstName: requester.name.split(' ')[0] ?? requester.name,
              title: `Wirkung zurückgewiesen: ${validation.initiative}`,
              link: `/lieferanten/${validation.relationshipId}/wirkung/initiativen/${validation.initiativeId}`,
            }),
          }));
        }
      }
      return this.load(tx, auth, id);
    });
  }

  /** Start: offene Anfragen für Personen mit Zusatzrolle Controlling. */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    if (!auth.organization?.buyer || !can(auth, 'wirkung.freigeben')) return [];
    return this.run(auth, async (tx) => {
      const open = await validationsOf(tx, { status: 'requested' });
      return open.map((entry) => ({
        id: entry.id,
        kind: 'validation' as const,
        supplier: entry.supplier,
        detail: entry.initiative,
        dueDate: new Date(Date.parse(entry.requestedAt) + reviewDays * 86_400_000)
          .toISOString()
          .slice(0, 10),
        href: `/wirkung/freigaben/${entry.id}`,
      }));
    });
  }
}
